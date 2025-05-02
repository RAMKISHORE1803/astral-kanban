"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addHours, addDays, subDays } from "date-fns";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";
import { KanbanEvent } from "@/app/lib/utils";
import EventCard from "./EventCard";
import EventDetail from "./EventDetail";
import sampleEventsContent from "@/app/lib/eventData";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import { cn } from "@/app/lib/utils";
import CalendarDayView from "./CalendarDayView";
import CalendarWeekView from "./CalendarWeekView";
import { flushSync } from "react-dom";

// Helper to get sample content randomly
const sampleTitles = Object.values(sampleEventsContent).flat().map(e => e.title);
const sampleDescriptions = Object.values(sampleEventsContent).flat().map(e => e.description);
const sampleImages = Object.values(sampleEventsContent).flat().map(e => e.imageUrl);
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Constants for edge detection
const EDGE_ZONE_WIDTH_PERCENTAGE = 0.2; // 20% of screen width for edge detection
const TRANSITION_COOLDOWN = 300; // ms to wait before allowing another transition
const CONTINUOUS_EDGE_COOLDOWN = 500; // Stricter cooldown for continuous edge detection

// Modified global state to improve synchronization with React
let globalDragTracking = {
  activeOverlay: null as HTMLDivElement | null,
  isTracking: false,
  currentPosition: { x: 0, y: 0 },
  animationFrame: null as number | null,
  offsetX: 0, // No offset for perfect finger tracking
  offsetY: 0,  // No offset for perfect finger tracking
  targetElement: null as HTMLElement | null, // Target element to snap back to
  synchronizingWithReact: false, // Flag to indicate a React state update is in progress
  dropPending: false, // Flag to indicate we're waiting for React to update before finalizing drop
  lastDetectedColumn: null as string | null, // Store the last detected column date
  inTransition: false, // Flag to prevent edge detection during transitions
  edgeDetectionEnabled: true, // Flag to control edge detection
  lastEdgeDetectionTime: 0, // Time when edge detection was last triggered
  activeHoldTimer: null as NodeJS.Timeout | null, // Timer for validating active edge holding
  firstEdgeEntryTime: 0, // Time when user first entered the edge zone
  hasBeenAtEdge: false, // Flag indicating if user has been continuously at the edge
};

// Improved overlay update function that coordinates with React state
function updateGlobalOverlayPosition() {
  if (!globalDragTracking.activeOverlay || !globalDragTracking.isTracking) return;
  
  const { x, y } = globalDragTracking.currentPosition;
  
  // Apply position with transform for better performance - center under finger
  if (globalDragTracking.activeOverlay) {
    const cardElement = globalDragTracking.activeOverlay.querySelector('div');
    if (cardElement) {
      const cardWidth = cardElement.offsetWidth;
      const cardHeight = cardElement.offsetHeight;
      
      // Position so finger is at center of card
      globalDragTracking.activeOverlay.style.transform = 
        `translate3d(${x - (cardWidth / 2)}px, ${y - (cardHeight / 2)}px, 0)`;
    }
  }

  // Continuously check for edge detection - but with controlled timing
  if (globalDragTracking.isTracking && 
      !globalDragTracking.inTransition && 
      globalDragTracking.edgeDetectionEnabled) {
    // Get container bounds for edge detection
    const container = document.querySelector('.calendar-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
      
      const now = Date.now();
      const atLeftEdge = x < containerRect.left + edgeWidth;
      const atRightEdge = x > containerRect.right - edgeWidth;
      const atEdge = atLeftEdge || atRightEdge;
      
      // Check if we're at an edge
      if (atEdge) {
        // If this is the first time at the edge, record the time
        if (!globalDragTracking.hasBeenAtEdge) {
          globalDragTracking.firstEdgeEntryTime = now;
          globalDragTracking.hasBeenAtEdge = true;
          
          // Set up an active hold timer to validate if the user is actively holding
          if (globalDragTracking.activeHoldTimer) {
            clearTimeout(globalDragTracking.activeHoldTimer);
          }
          
          globalDragTracking.activeHoldTimer = setTimeout(() => {
            // User has been actively holding at the edge, now we can trigger
            const edgeDirection = atLeftEdge ? 'left' : 'right';
            if (now - globalDragTracking.lastEdgeDetectionTime > CONTINUOUS_EDGE_COOLDOWN) {
              globalDragTracking.lastEdgeDetectionTime = now;
              document.dispatchEvent(new CustomEvent('edgeDetected', { 
                detail: { 
                  edge: edgeDirection,
                  activeHold: true
                } 
              }));
            }
          }, 100);
        }
        // For subsequent frames while at the edge
        else if (now - globalDragTracking.firstEdgeEntryTime > 200) {
          // Only trigger after being at edge for a minimum time AND respecting cooldown
          if (now - globalDragTracking.lastEdgeDetectionTime > CONTINUOUS_EDGE_COOLDOWN) {
            globalDragTracking.lastEdgeDetectionTime = now;
            const edgeDirection = atLeftEdge ? 'left' : 'right';
            document.dispatchEvent(new CustomEvent('edgeDetected', { 
              detail: { 
                edge: edgeDirection,
                activeHold: true
              } 
            }));
          }
        }
      } else {
        // Reset edge tracking when not at edge
        globalDragTracking.hasBeenAtEdge = false;
        if (globalDragTracking.activeHoldTimer) {
          clearTimeout(globalDragTracking.activeHoldTimer);
          globalDragTracking.activeHoldTimer = null;
        }
      }
    }
  }

  // Continue the animation loop
  globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
}

// Improved snap animation with better coordination
function snapToPosition(targetX: number, targetY: number, onComplete: () => void) {
  if (!globalDragTracking.activeOverlay) return onComplete();
  
  // Calculate starting position
  const cardElement = globalDragTracking.activeOverlay.querySelector('div');
  if (!cardElement) return onComplete();
  
  const cardWidth = cardElement.offsetWidth;
  const cardHeight = cardElement.offsetHeight;
  
  const startX = globalDragTracking.currentPosition.x - (cardWidth / 2);
  const startY = globalDragTracking.currentPosition.y - (cardHeight / 2);
  
  const startTime = performance.now();
  const duration = 300; // ms
  
  // Use a spring-like animation for natural feel
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Cubic bezier easing for Android-like feel
    const easing = (t: number) => {
      return t < 0.5
        ? 4 * t * t * t
        : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    };
    
    const easedProgress = easing(progress);
    
    const currentX = startX + (targetX - startX) * easedProgress;
    const currentY = startY + (targetY - startY) * easedProgress;
    
    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Ensure we're positioned exactly at the target
      if (globalDragTracking.activeOverlay) {
        globalDragTracking.activeOverlay.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      onComplete();
    }
  };
  
  globalDragTracking.activeOverlay.style.transition = 'none';
  requestAnimationFrame(animate);
}

interface CalendarContainerProps {
  currentDate: Date;
  view: "week" | "day";
  onDateChange: (date: Date) => void;
}

const CalendarContainer = ({ currentDate, view, onDateChange }: CalendarContainerProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [allEvents, setAllEvents] = useState<KanbanEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<KanbanEvent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDateRef = useRef<Date | null>(null); // Allow null initially
  
  // State for Event Detail View modal
  const [detailViewEvent, setDetailViewEvent] = useState<KanbanEvent | null>(null);
  const [detailViewState, setDetailViewState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const originRectRef = useRef<{x: number, y: number, width: number, height: number, scrollY: number} | null>(null);
  
  // Custom drag tracking state
  const [customDragState, setCustomDragState] = useState<{
    isDragging: boolean;
    event: KanbanEvent | null;
    position: { x: number, y: number } | null;
    startedOn: string | null;
    currentlyHovering: 'left' | 'right' | null;
    dropTargetId: string | null; // For reordering
  }>({
    isDragging: false,
    event: null,
    position: null,
    startedOn: null,
    currentlyHovering: null,
    dropTargetId: null
  });
  
  // Timer for edge transitions
  const edgeTransitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Counter for traversed days
  const dayOffsetRef = useRef(0);
  
  // Debug flag to track transitions
  const debugRef = useRef({
    transitionsAttempted: 0,
    transitionsCompleted: 0
  });

  // Track whether we're in a transition
  const isTransitioningRef = useRef(false);
    
  // Add a ref to track the last transition time
  const lastTransitionTimeRef = useRef(0);
  
  // Refs for callbacks / coordination
  const triggerDateChangeRef = useRef<(direction: 'left' | 'right', isActiveHold?: boolean) => void>();
  const finalizeCustomDragRef = useRef<() => void>(); // Might not be needed anymore
  const reactSyncRef = useRef({
    lastStateUpdate: 0,
    targetDateAfterTransition: null as string | null,
    dropRequested: false,
    pendingUpdate: false
  });
  const prevDateAnimRef = useRef<{ date: Date | null, direction: 'left' | 'right' | null }>({ date: null, direction: null });

  // --- Computed Values --- 
  const effectiveView = isMobile ? "day" : view;

  const filteredEvents = useMemo(() => {
    if (effectiveView === "day") {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      return allEvents.filter(event => event.date === dateStr);
    } else { // effectiveView === "week"
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const weekDates = new Set(
        eachDayOfInterval({ start: weekStart, end: weekEnd })
        .map(d => format(d, "yyyy-MM-dd"))
      );
      return allEvents.filter(event => weekDates.has(event.date));
    }
  }, [allEvents, currentDate, effectiveView]);

  const eventsByDateForWeek = useMemo(() => {
    if (effectiveView !== "week") return {};
    const grouped: { [date: string]: KanbanEvent[] } = {};
    filteredEvents.forEach(event => {
      if (!grouped[event.date]) { grouped[event.date] = []; }
      grouped[event.date].push(event);
    });
    return grouped;
  }, [filteredEvents, effectiveView]);

  // --- Core Callbacks (Defined using useCallback) ---

  const finalizeCustomDrag = useCallback(() => {
    if (!customDragState.isDragging || !customDragState.event) {
      return;
    }
    
    console.log("Finalizing drag with snap animation");
    
    // If we're still in transition, wait a bit
    if (globalDragTracking.inTransition || isTransitioningRef.current) {
      console.log("Delaying drop until transition completes");
      globalDragTracking.dropPending = true;
      
      setTimeout(() => {
        if (globalDragTracking.dropPending) {
          console.log("Completing delayed drop");
          finalizeCustomDrag(); 
        }
      }, 150);
      return;
    }
    
    // Stop global tracking
    globalDragTracking.isTracking = false;
    globalDragTracking.dropPending = false;
    
    // Stop animation frame
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }
    
    const currentDateStr = format(currentDate, "yyyy-MM-dd");
    let targetDateStr = currentDateStr;
    if (globalDragTracking.lastDetectedColumn) {
      targetDateStr = globalDragTracking.lastDetectedColumn;
    }
    
    const droppedEvent = customDragState.event;
    let insertAt = -1;
    
    if (droppedEvent && customDragState.position) {
      const { x, y } = customDragState.position;
      const elementsAtPoint = document.elementsFromPoint(x, y);
      const columnElement = elementsAtPoint.find(el => el.hasAttribute('data-date') || el.closest('[data-date]'));
      if (columnElement) {
        const dateAttr = columnElement.getAttribute('data-date') || columnElement.closest('[data-date]')?.getAttribute('data-date');
        if (dateAttr) {
          targetDateStr = dateAttr;
          console.log(`Detected drop in column with date: ${targetDateStr}`);
        }
      }
      
      const eventCardElement = elementsAtPoint.find(el => el.classList.contains('event-card') || el.closest('.event-card'));
      if (eventCardElement) {
        const eventCard = eventCardElement.classList.contains('event-card') ? eventCardElement : eventCardElement.closest('.event-card');
        const targetEventId = eventCard?.getAttribute('data-event-id');
        if (targetEventId) {
          const eventsInColumn = allEvents.filter(e => e.date === targetDateStr);
          const targetIndex = eventsInColumn.findIndex(e => e.id === targetEventId);
          if (targetIndex !== -1) {
            insertAt = targetIndex;
          }
        }
      }
    }
    
    console.log(`Moving event "${droppedEvent.title}" to ${targetDateStr}`);
    
    globalDragTracking.synchronizingWithReact = true;
    reactSyncRef.current.lastStateUpdate = Date.now();
    
    flushSync(() => {
      const eventsWithoutDragged = allEvents.filter(e => e.id !== droppedEvent.id);
      const updatedEvent = { ...droppedEvent, date: targetDateStr };
      const dateEvents = eventsWithoutDragged.filter(e => e.date === targetDateStr);
      
      if (insertAt === -1) {
        setAllEvents([...eventsWithoutDragged, updatedEvent]);
      } else {
        const newDateEvents = [...dateEvents];
        newDateEvents.splice(insertAt, 0, updatedEvent);
        setAllEvents([...eventsWithoutDragged.filter(e => e.date !== targetDateStr), ...newDateEvents]);
      }
      
      setCustomDragState({
        isDragging: false, event: null, position: null, startedOn: null, currentlyHovering: null, dropTargetId: null
      });
    });
    
    requestAnimationFrame(() => {
      console.log("Querying DOM after flushSync and rAF");
      const newCardElement = document.querySelector(`[data-event-id="${droppedEvent.id}"]`);
      
      if (newCardElement && globalDragTracking.activeOverlay) {
        const targetRect = newCardElement.getBoundingClientRect();
        console.log("Found target position:", targetRect.left, targetRect.top);
        snapToPosition(targetRect.left, targetRect.top, () => {
          if (globalDragTracking.activeOverlay) {
            globalDragTracking.activeOverlay.style.display = 'none';
          }
          if (navigator.vibrate) navigator.vibrate(10);
          globalDragTracking.synchronizingWithReact = false;
        });
        newCardElement.classList.add('pulse-highlight');
        setTimeout(() => { newCardElement.classList.remove('pulse-highlight'); }, 500);
      } else {
        console.log("Target element not found for animation, using fallback");
        if (globalDragTracking.activeOverlay) {
          globalDragTracking.activeOverlay.style.transition = 'opacity 0.3s ease';
          globalDragTracking.activeOverlay.style.opacity = '0';
          setTimeout(() => {
            if (globalDragTracking.activeOverlay) {
              globalDragTracking.activeOverlay.style.display = 'none';
              globalDragTracking.activeOverlay.style.transition = '';
              globalDragTracking.activeOverlay.style.opacity = '1';
            }
            globalDragTracking.synchronizingWithReact = false;
          }, 300);
        }
      }
      
      isTransitioningRef.current = false;
      globalDragTracking.inTransition = false;
      if (edgeTransitionTimerRef.current) {
        clearTimeout(edgeTransitionTimerRef.current);
        edgeTransitionTimerRef.current = null;
      }
      document.body.style.overflow = '';
      document.body.classList.remove('calendar-dragging');
    });

  }, [customDragState, currentDate, allEvents]); // Restore original dependencies

  const triggerDateChange = useCallback((direction: 'left' | 'right', isActiveHold?: boolean) => {
    if (isTransitioningRef.current || globalDragTracking.inTransition) return;
    const now = Date.now();
    const cooldownTime = isActiveHold ? CONTINUOUS_EDGE_COOLDOWN : TRANSITION_COOLDOWN;
    if (now - lastTransitionTimeRef.current < cooldownTime) return;
    
    console.log(`Triggering date change to ${direction}${isActiveHold ? ' (active hold)' : ''}`);
    isTransitioningRef.current = true;
    globalDragTracking.inTransition = true;
    lastTransitionTimeRef.current = now;
    globalDragTracking.edgeDetectionEnabled = false;
    
    if (customDragState.isDragging && globalDragTracking.activeOverlay) {
      const cardElement = globalDragTracking.activeOverlay.querySelector('div');
      if (cardElement) {
        cardElement.classList.add('pulse-outline');
        cardElement.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.25)';
      }
    }
    
    const newDate = direction === 'left' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    const newDateStr = format(newDate, "yyyy-MM-dd");
    
    reactSyncRef.current.targetDateAfterTransition = newDateStr;
    globalDragTracking.lastDetectedColumn = newDateStr;
    dayOffsetRef.current += direction === 'left' ? -1 : 1;
    if (navigator.vibrate) navigator.vibrate(25);
    
    if (customDragState.isDragging && customDragState.event) {
      const updatedEvent = { ...customDragState.event, date: newDateStr };
      globalDragTracking.synchronizingWithReact = true;
      reactSyncRef.current.lastStateUpdate = Date.now();
      setCustomDragState(prev => ({ ...prev, event: updatedEvent, currentlyHovering: null, dropTargetId: null }));
    }
    
    // Set the animation direction BEFORE changing the date
    prevDateAnimRef.current = { date: currentDate, direction }; 
    
    onDateChange(newDate);
    
    setTimeout(() => {
      if (globalDragTracking.activeOverlay) {
        const cardElement = globalDragTracking.activeOverlay.querySelector('div');
        if (cardElement) {
          cardElement.classList.remove('pulse-outline');
          cardElement.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
        }
      }
      
      isTransitioningRef.current = false;
      globalDragTracking.inTransition = false;
      globalDragTracking.synchronizingWithReact = false;
      console.log("Transition complete");
      
      if (globalDragTracking.dropPending) {
        console.log("Processing delayed drop after transition");
        finalizeCustomDrag();
        return;
      }
      
      setTimeout(() => {
        console.log("Re-enabling edge detection");
        globalDragTracking.edgeDetectionEnabled = true;
        globalDragTracking.hasBeenAtEdge = false;
        globalDragTracking.firstEdgeEntryTime = 0;
      }, 200);
      
    }, 300);
  }, [customDragState, currentDate, onDateChange, finalizeCustomDrag]); // Restore original dependencies

  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number) => {
    // ... (Implementation from before hoisting attempts) ...
    dayOffsetRef.current = 0;
    isTransitioningRef.current = false;
    globalDragTracking.inTransition = false;
    globalDragTracking.synchronizingWithReact = false;
    globalDragTracking.dropPending = false;
    globalDragTracking.lastDetectedColumn = event.date;
    globalDragTracking.edgeDetectionEnabled = true;
    globalDragTracking.lastEdgeDetectionTime = 0;
    globalDragTracking.hasBeenAtEdge = false;
    globalDragTracking.firstEdgeEntryTime = 0;
    if (globalDragTracking.activeHoldTimer) {
      clearTimeout(globalDragTracking.activeHoldTimer);
      globalDragTracking.activeHoldTimer = null;
    }
    globalDragTracking.isTracking = true;
    globalDragTracking.currentPosition = { x: clientX, y: clientY };

    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.innerHTML = '';
      const eventCardHtml = `
        <div class="bg-white rounded-lg border border-slate-200 shadow-lg p-3" style="width: auto; max-width: 320px; transform: scale(1.05); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25); will-change: transform; backface-visibility: hidden;">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-slate-800">${event.title}</h3>
            <span class="text-xs text-slate-500">${event.time}</span>
          </div>
          ${event.imageUrl ? 
            `<div class="mb-2 rounded overflow-hidden h-20 bg-slate-100">
              <img src="${event.imageUrl}" alt="" class="w-full h-full object-cover">
            </div>` : ''}
          ${event.description ? 
            `<p class="text-sm text-slate-600 line-clamp-2">${event.description}</p>` : ''}
        </div>
      `;
      globalDragTracking.activeOverlay.innerHTML = eventCardHtml;
      globalDragTracking.activeOverlay.style.display = 'block';
      
      const originalCard = document.querySelector(`[data-event-id="${event.id}"]`);
      if (originalCard) {
        const originalRect = originalCard.getBoundingClientRect();
        globalDragTracking.targetElement = originalCard as HTMLElement;
        globalDragTracking.activeOverlay.style.transform = `translate3d(${originalRect.left}px, ${originalRect.top}px, 0)`;
        setTimeout(() => {
          if (globalDragTracking.activeOverlay) {
            globalDragTracking.activeOverlay.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            const cardElement = globalDragTracking.activeOverlay.querySelector('div');
            if (cardElement) {
              const cardWidth = cardElement.offsetWidth;
              const cardHeight = cardElement.offsetHeight;
              globalDragTracking.activeOverlay.style.transform = `translate3d(${clientX - (cardWidth / 2)}px, ${clientY - (cardHeight / 2)}px, 0)`;
            }
            setTimeout(() => {
              if (globalDragTracking.activeOverlay) {
                globalDragTracking.activeOverlay.style.transition = 'none';
              }
              if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
              globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
            }, 150);
          }
        }, 0);
    } else {
        const cardElement = globalDragTracking.activeOverlay?.querySelector('div');
        if (cardElement) {
          const cardWidth = cardElement.offsetWidth;
          const cardHeight = cardElement.offsetHeight;
          globalDragTracking.activeOverlay.style.transform = `translate3d(${clientX - (cardWidth / 2)}px, ${clientY - (cardHeight / 2)}px, 0)`;
        }
        if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
        globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
      }
      if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
    }
    
    setCustomDragState({
      isDragging: true, event: event, position: { x: clientX, y: clientY }, startedOn: event.date, currentlyHovering: null, dropTargetId: null
    });
    document.body.style.overflow = 'hidden';
    document.body.classList.add('calendar-dragging');
    setSelectedEvent(null);
    console.log("Drag started with Android-like lift animation", clientX, clientY);
  }, []);

  const handleEventMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => {
    if (!('touches' in e)) e.preventDefault(); 
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    console.log("Starting drag at", clientX, clientY);
    startCustomDrag(event, clientX, clientY);
  }, [startCustomDrag]);

  // --- Event Detail Modal Handlers --- 
  const handleEventCardClick = useCallback((event: KanbanEvent, cardElement: HTMLElement) => {
    if (customDragState.isDragging) return;
    const rect = cardElement.getBoundingClientRect();
    originRectRef.current = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scrollY: window.scrollY };
    document.body.style.overflow = 'hidden';
    setDetailViewEvent(event);
    setDetailViewState('opening');
    setTimeout(() => {
      setDetailViewState('open');
    }, 300);
  }, [customDragState.isDragging]);

  const closeDetailView = useCallback(() => {
    setDetailViewState('closing');
    setTimeout(() => {
      setDetailViewState('closed');
      setDetailViewEvent(null);
      originRectRef.current = null;
      document.body.style.overflow = '';
    }, 300);
  }, []);

  const handleEventClick = useCallback((event: KanbanEvent, cardElement?: HTMLElement) => {
     if (customDragState.isDragging) return;
     let element = cardElement;
     if (!element) {
       element = document.querySelector(`[data-event-id="${event.id}"]`) as HTMLElement;
     }
     if (element) {
       handleEventCardClick(event, element);
     } else {
       console.log('Event card element not found, opening without animation');
       setDetailViewEvent(event);
       setDetailViewState('open');
       document.body.style.overflow = 'hidden';
     }
  }, [customDragState.isDragging, handleEventCardClick]);
  
  // --- Drag Cancellation --- 
  const cancelCustomDrag = useCallback(() => {
    if (!customDragState.isDragging) return;
    console.log("Cancelling drag (e.g., Escape key)");
    // Stop global tracking immediately
    globalDragTracking.isTracking = false;
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }
    // Hide overlay immediately (or fade out)
    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.style.transition = 'opacity 0.2s ease';
      globalDragTracking.activeOverlay.style.opacity = '0';
      setTimeout(() => {
        if (globalDragTracking.activeOverlay) {
          globalDragTracking.activeOverlay.style.display = 'none';
          globalDragTracking.activeOverlay.style.opacity = '1';
          globalDragTracking.activeOverlay.style.transition = '';
        }
      }, 200);
    }
    // Reset React state
    setCustomDragState({ isDragging: false, event: null, position: null, startedOn: null, currentlyHovering: null, dropTargetId: null });
    // Reset global flags
    globalDragTracking.inTransition = false;
    globalDragTracking.dropPending = false;
    globalDragTracking.edgeDetectionEnabled = true;
    // Clear timers
    if (edgeTransitionTimerRef.current) {
      clearTimeout(edgeTransitionTimerRef.current);
      edgeTransitionTimerRef.current = null;
    }
    // Re-enable scrolling
    document.body.style.overflow = '';
    document.body.classList.remove('calendar-dragging');
  }, [customDragState.isDragging]); // Dependency on isDragging ensures latest state

  // --- UseEffect Hooks (Restored Order) ---

  useEffect(() => {
    // ... (Overlay initialization logic - from previous restore) ...
    const createOverlay = () => {
      if (globalDragTracking.activeOverlay) {
        try { document.body.removeChild(globalDragTracking.activeOverlay); } catch (e) {}
      }
      if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'global-drag-overlay';
      Object.assign(overlayDiv.style, { position: 'fixed', pointerEvents: 'none', zIndex: '9999', top: '0', left: '0', display: 'none', transformOrigin: 'center center', willChange: 'transform', backfaceVisibility: 'hidden' });
      overlayDiv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlayDiv);
      globalDragTracking.activeOverlay = overlayDiv;
      globalDragTracking.isTracking = false;
    };
    createOverlay();
    const globalPointerMove = (e: PointerEvent) => {
      if (globalDragTracking.isTracking) {
        globalDragTracking.currentPosition = { x: e.clientX, y: e.clientY };
        if (!globalDragTracking.animationFrame) {
          globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
        }
      }
    };
    document.addEventListener('pointermove', globalPointerMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', globalPointerMove);
      if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
      if (globalDragTracking.activeOverlay) {
        try { document.body.removeChild(globalDragTracking.activeOverlay); } catch (e) {}
        globalDragTracking.activeOverlay = null;
      }
      globalDragTracking.isTracking = false;
    };
  }, []);
  
  useEffect(() => {
    // ... (Original edge detection listener logic) ...
    const handleEdgeDetection = (e: CustomEvent) => {
      if (triggerDateChangeRef.current && !isTransitioningRef.current && !globalDragTracking.inTransition && globalDragTracking.edgeDetectionEnabled) {
        const edge = e.detail?.edge as 'left' | 'right';
        const isActiveHold = !!e.detail?.activeHold;
        if (edge) {
          triggerDateChangeRef.current(edge, isActiveHold);
        }
      }
    };
    document.addEventListener('edgeDetected', handleEdgeDetection as EventListener);
    return () => { document.removeEventListener('edgeDetected', handleEdgeDetection as EventListener); };
  }, []); 

  useEffect(() => {
    // ... (Original pointer event listener logic for drag) ...
    if (!customDragState.isDragging) return;
    console.log("Setting up global POINTER event handlers for drag");
    const handlePointerMove = (e: PointerEvent) => {
      globalDragTracking.currentPosition = { x: e.clientX, y: e.clientY };
      setCustomDragState(prev => ({ ...prev, position: { x: e.clientX, y: e.clientY } }));
      
      // Edge detection logic within move handler (for hover effect)
      if (!isTransitioningRef.current && !globalDragTracking.inTransition && effectiveView === 'day') {
        const container = document.querySelector('.calendar-container');
        const containerRect = container ? container.getBoundingClientRect() : containerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
          const leftEdgeBoundary = containerRect.left + edgeWidth;
          const rightEdgeBoundary = containerRect.right - edgeWidth;
          
          let currentEdge: 'left' | 'right' | null = null;
          if (e.clientX < leftEdgeBoundary) {
            currentEdge = 'left';
          } else if (e.clientX > rightEdgeBoundary) {
            currentEdge = 'right';
          }
          
          // Update hover state and trigger vibration if edge changes
          if (currentEdge !== customDragState.currentlyHovering) {
             // ADD VIBRATION HERE:
             if (currentEdge && navigator.vibrate) {
                console.log(`Vibrating for edge hover: ${currentEdge}`);
                navigator.vibrate(10); // Short vibration for hover detection
             }
             setCustomDragState(prev => ({ 
               ...prev, 
               currentlyHovering: currentEdge 
             }));
             // Note: Actual transition triggering is handled by the separate edgeDetected event
          }

          // Drop target/column detection logic (remains the same)
          // ... (column/drop target detection) ...
            const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
            const columnElement = elementsAtPoint.find(el => el.hasAttribute('data-date') || el.closest('[data-date]'));
            if (columnElement) {
                const dateAttr = columnElement.getAttribute('data-date') || columnElement.closest('[data-date]')?.getAttribute('data-date');
                if (dateAttr && dateAttr !== globalDragTracking.lastDetectedColumn) {
                    globalDragTracking.lastDetectedColumn = dateAttr;
                    console.log(`Hovering over column with date: ${dateAttr}`);
                }
            }
            const eventCardUnderCursor = elementsAtPoint.find(el => {
                const card = el.closest('.event-card');
                return card && card.getAttribute('data-event-id') && card.getAttribute('data-event-id') !== customDragState.event?.id;
            });
            const bottomDropZone = elementsAtPoint.find(el => el.getAttribute('data-drop-zone') === 'bottom');
            let targetEventId = eventCardUnderCursor?.closest('.event-card')?.getAttribute('data-event-id') || null;
            if (!targetEventId && bottomDropZone && filteredEvents.length > 0) {
                targetEventId = filteredEvents[filteredEvents.length - 1].id;
            }
            if (customDragState.dropTargetId !== targetEventId) {
                setCustomDragState(prev => ({ ...prev, dropTargetId: targetEventId }));
            }
        }
      }
    };
    const handlePointerEnd = (e: PointerEvent) => {
      console.log(`%cPOINTER END EVENT DETECTED: ${e.type}`, "color: red; font-weight: bold;");
      if (!globalDragTracking.isTracking) return;
      if (isTransitioningRef.current || globalDragTracking.inTransition) {
        console.log("%cPointer up/cancel during transition - marking drop as pending.", "color: orange;");
        globalDragTracking.dropPending = true;
        return;
      }
      console.log("%cFinalizing drag immediately on pointer event:", "color: green;", e.type);
      finalizeCustomDrag();
    };
    document.addEventListener('pointermove', handlePointerMove, { capture: true });
    document.addEventListener('pointerup', handlePointerEnd, { capture: true });
    document.addEventListener('pointercancel', handlePointerEnd, { capture: true });
    document.body.style.userSelect = 'none';
    return () => {
      console.log("Removing global POINTER event handlers for drag");
      document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      document.removeEventListener('pointerup', handlePointerEnd, { capture: true });
      document.removeEventListener('pointercancel', handlePointerEnd, { capture: true });
      document.body.style.userSelect = '';
    };
  }, [customDragState.isDragging, finalizeCustomDrag]); 

  useEffect(() => {
    // Assign triggerDateChange to ref - MUST be after triggerDateChange is defined
    triggerDateChangeRef.current = triggerDateChange;
  }, [triggerDateChange]);

  useEffect(() => {
    // Update animation ref for direction
    prevDateAnimRef.current = { ...prevDateAnimRef.current, date: currentDate };
  }, [currentDate]);
  
  useEffect(() => {
    // ... (Mock event generation logic) ...
    const generatedEvents: KanbanEvent[] = [];
    const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const initialWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const daysInInitialWeek = eachDayOfInterval({ start: initialWeekStart, end: initialWeekEnd });

    daysInInitialWeek.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const numEvents = Math.floor(Math.random() * 3) + 1; // 1 to 3 events per day

      for (let i = 0; i < numEvents; i++) {
        const startHour = 8 + Math.floor(Math.random() * 10); // 8 AM to 5 PM start times
        const eventStart = addHours(day, startHour);
        const eventTimeStr = format(eventStart, "hh:mm a");
        
        generatedEvents.push({
          id: `event-${dateStr}-${i}`,
          title: getRandomElement(sampleTitles),
          description: getRandomElement(sampleDescriptions),
          imageUrl: getRandomElement(sampleImages), // Always assign an image
          time: eventTimeStr,
          date: dateStr,
        });
      }
    });
    setAllEvents(generatedEvents);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Render Logic --- 

  // Define animation variants (Keep these)
  const iosSlideVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? '100%' : '-100%',
      opacity: 0.8,
      scale: 0.98,
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
      zIndex: 1,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      zIndex: 2,
      transition: {
        type: "spring", stiffness: 280, damping: 30, mass: 0.8,
        opacity: { duration: 0.3, ease: "easeOut" },
        scale: { duration: 0.3, ease: "easeOut" },
      }
    },
    exit: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? '-50%' : '50%',
      opacity: 0.5,
      scale: 0.95,
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
      zIndex: 1,
      transition: {
        type: "spring", stiffness: 280, damping: 30, mass: 0.8,
        opacity: { duration: 0.2, ease: "easeIn" },
        scale: { duration: 0.2, ease: "easeIn" },
      }
    }),
  };
  const fadeVariants = {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-white rounded-b-astral shadow-sm border border-slate-100 border-t-0 flex-1 flex flex-col relative calendar-container overflow-hidden", // Added overflow-hidden
        customDragState.isDragging && "touch-none"
      )}
    >
      {/* Status indicator */}
      {customDragState.isDragging && isTransitioningRef.current && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-500 h-1 animate-pulse"></div>
      )}
      
      <AnimatePresence 
        initial={false} 
        mode="wait" 
        custom={prevDateAnimRef.current.direction} // Pass direction
      >
        <motion.div
          key={format(currentDate, 'yyyy-MM-dd')}
          custom={prevDateAnimRef.current.direction} // Pass direction again
          variants={effectiveView === 'day' && prevDateAnimRef.current.direction ? iosSlideVariants : fadeVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ 
             x: { type: "spring", stiffness: 280, damping: 30, mass: 0.8 },
             opacity: { duration: 0.3 }
          }}
          className="h-full w-full flex-1"
        >
          {effectiveView === 'week' ? (
            <CalendarWeekView
              currentDate={currentDate}
              eventsByDate={eventsByDateForWeek}
              customDragState={customDragState}
              onEventClick={handleEventClick} 
              onEventMouseDown={handleEventMouseDown} 
            />
          ) : (
            <CalendarDayView
              currentDate={currentDate}
              dayEvents={filteredEvents}
              customDragState={customDragState}
              dayOffset={dayOffsetRef.current}
              debugInfo={debugRef.current}
              onEventClick={handleEventClick} 
              onEventMouseDown={handleEventMouseDown} 
            />
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Escape key handler for cancelling drag */}
      {customDragState.isDragging && (
        <div
          style={{ position: 'fixed', top: '-9999px', left: '-9999px' }} 
          ref={(el) => el?.focus()}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              cancelCustomDrag();
            }
          }}
        />
      )}
      
      {/* Full-screen detailed event view */}
      {detailViewEvent && (
        <AnimatePresence mode="wait">
          <motion.div 
            key="modal-backdrop"
            className="fixed inset-0 z-[9999]"
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)', backdropFilter: 'blur(0px)' }}
            animate={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.85)', 
              backdropFilter: 'blur(8px)'
            }}
            exit={{ 
              backgroundColor: 'rgba(0, 0, 0, 0)', 
              backdropFilter: 'blur(0px)',
              transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
            }}
            transition={{ 
              duration: 0.5, 
              ease: [0.22, 1, 0.36, 1]
            }}
            onClick={closeDetailView}
          >
            <motion.div 
              key="modal-content"
              className="bg-white w-full h-full overflow-hidden fixed top-0 left-0"
              style={{
                originX: originRectRef.current ? (originRectRef.current.x + (originRectRef.current.width / 2)) / window.innerWidth : 0.5,
                originY: originRectRef.current ? (originRectRef.current.y + (originRectRef.current.height / 2)) / window.innerHeight : 0.5,
              }}
              initial={{ 
                borderRadius: '12px',
                x: originRectRef.current?.x || 0,
                y: originRectRef.current ? (originRectRef.current.y - window.scrollY + originRectRef.current.scrollY) : 0,
                width: originRectRef.current?.width || '100%',
                height: originRectRef.current?.height || '100%',
                opacity: 1,
                boxShadow: '0 0 0 rgba(0,0,0,0)',
              }}
              animate={{ 
                borderRadius: 0,
                x: 0,
                y: 0,
                width: '100%',
                height: '100%',
                opacity: 1,
                boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
              }}
              exit={{ 
                borderRadius: '12px',
                x: originRectRef.current?.x || 0,
                y: originRectRef.current ? (originRectRef.current.y - window.scrollY + originRectRef.current.scrollY) : 0,
                width: originRectRef.current?.width || 0,
                height: originRectRef.current?.height || 0,
                opacity: 0,
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              }}
              transition={{ 
                type: "spring",
                damping: 25, 
                stiffness: 300,
                mass: 0.85,
              }}
              onClick={e => e.stopPropagation()}
            >
              <motion.div 
                className="h-full w-full overflow-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Hero header section with enhanced animations */}
                <div className="relative w-full overflow-hidden" style={{ height: detailViewEvent.imageUrl ? '45vh' : '35vh' }}>
                  {detailViewEvent.imageUrl ? (
                    <motion.div 
                      className="absolute inset-0"
                      initial={{ opacity: 0.7 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.7 }}
                      transition={{ duration: 0.6 }}
                    >
                      {/* Background image with more dramatic scaling effect */}
                      <motion.div 
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${detailViewEvent.imageUrl})` }}
                        initial={{ scale: 1.1, filter: 'brightness(0.8) saturate(0.9)' }}
                        animate={{ 
                          scale: 1.05, 
                          filter: 'brightness(0.9) saturate(1.1)' 
                        }}
                        exit={{ 
                          scale: 1.15, 
                          filter: 'brightness(0.8) saturate(0.9)',
                          transition: { duration: 0.6 }
                        }}
                        transition={{ 
                          duration: 1.2,
                          ease: [0.22, 1, 0.36, 1]
                        }}
                      />
                      
                      {/* Enhanced gradient overlay with motion */}
                      <motion.div 
                        className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70"
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0.3 }}
                        transition={{ duration: 0.8 }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800"
                      initial={{ opacity: 0.8, background: "linear-gradient(to bottom right, #2563eb, #4338ca)" }}
                      animate={{ 
                        opacity: 1, 
                        background: "linear-gradient(to bottom right, #3b82f6, #4f46e5)"
                      }}
                      exit={{ 
                        opacity: 0.8, 
                        background: "linear-gradient(to bottom right, #2563eb, #4338ca)"
                      }}
                      transition={{ duration: 0.8 }}
                    />
                  )}
                  
                  {/* Title and time info with orchestrated staggered animation */}
                  <motion.div 
                    className="absolute bottom-0 left-0 w-full p-6 pb-8 text-white"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ 
                      opacity: 0, 
                      y: 20,
                      transition: { duration: 0.25, ease: "easeIn" }
                    }}
                    transition={{ 
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.15
                    }}
                  >
                    <motion.div 
                      className="flex items-center gap-2 text-white/90 mb-2 text-sm"
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ 
                        opacity: 0, 
                        y: 10, 
                        scale: 0.95,
                        transition: { duration: 0.2, ease: "easeIn" }
                      }}
                      transition={{ 
                        duration: 0.4,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.25
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <span>{detailViewEvent.time}</span>
                      <span className="mx-1">•</span>
                      <span>{detailViewEvent.date}</span>
                    </motion.div>
                    
                    <motion.h1 
                      className="text-3xl font-bold text-white"
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ 
                        opacity: 0, 
                        y: 15, 
                        scale: 0.95,
                        transition: { duration: 0.2, ease: "easeIn" }
                      }}
                      transition={{ 
                        duration: 0.5,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.35
                      }}
                      style={{ textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
                    >
                      {detailViewEvent.title}
                    </motion.h1>
                  </motion.div>
                  
                  {/* Close button with enhanced animation */}
                  <motion.button
                    className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white"
                    onClick={closeDetailView}
                    initial={{ opacity: 0, y: -20, scale: 0.8, rotate: -90 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    exit={{ 
                      opacity: 0, 
                      y: -15, 
                      scale: 0.8, 
                      rotate: -90,
                      transition: { duration: 0.3, ease: [0.32, 0, 0.67, 0] }
                    }}
                    transition={{ 
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.5
                    }}
                    style={{
                      backdropFilter: 'blur(3px)',
                      WebkitBackdropFilter: 'blur(3px)'
                    }}
                    whileHover={{ 
                      scale: 1.1, 
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      boxShadow: '0 0 20px rgba(0,0,0,0.2)'
                    }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
                
                {/* Content area with orchestrated staggered animations */}
                <div className="p-6 px-8 bg-white">
                  {/* Description with enhanced animation */}
                  <motion.div 
                    className="mb-8"
                    initial={{ opacity: 0, y: 40, x: -10 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ 
                      opacity: 0, 
                      y: 30, 
                      x: -5,
                      transition: { duration: 0.25, ease: "easeIn" }
                    }}
                    transition={{ 
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.45
                    }}
                  >
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Description</h2>
                    <p className="text-gray-600 leading-relaxed">
                      {detailViewEvent.description || "No description available for this event."}
                    </p>
                  </motion.div>
                  
                  {/* Location section with enhanced animation */}
                  <motion.div 
                    className="mb-8"
                    initial={{ opacity: 0, y: 45, x: -10 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ 
                      opacity: 0, 
                      y: 35, 
                      x: -5,
                      transition: { duration: 0.25, ease: "easeIn" }
                    }}
                    transition={{ 
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.55
                    }}
                  >
                    <h2 className="text-xl font-semibold text-gray-800 mb-3">Location</h2>
                    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100">
                      <div className="bg-blue-100 text-blue-500 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s-8-4.5-8-11.8a8 8 0 0 1 16 0c0 7.3-8 11.8-8 11.8z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <span className="text-gray-700">Meeting Room {Math.floor(Math.random() * 10) + 1}</span>
                    </div>
                  </motion.div>
                  
                  {/* Action buttons with enhanced animation */}
                  <motion.div 
                    className="flex gap-3 pt-4 border-t border-gray-200"
                    initial={{ opacity: 0, y: 50, x: -10 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ 
                      opacity: 0, 
                      y: 40, 
                      x: -5,
                      transition: { duration: 0.25, ease: "easeIn" }
                    }}
                    transition={{ 
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.65
                    }}
                  >
                    <motion.button 
                      className="flex-1 py-3.5 px-4 bg-gray-100 rounded-xl text-gray-700 font-medium flex items-center justify-center gap-2"
                      onClick={closeDetailView}
                      whileHover={{ 
                        backgroundColor: "#e5e7eb", 
                        scale: 1.02,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                      }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      Back
                    </motion.button>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .modal-open { animation: fade-in 400ms forwards cubic-bezier(0.16, 1, 0.3, 1); }
        .modal-close { animation: fade-in 400ms forwards cubic-bezier(0.16, 1, 0.3, 1) reverse; }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
      `}</style>
    </div>
  );
};

export default CalendarContainer;