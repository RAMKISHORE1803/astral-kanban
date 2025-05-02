"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addHours, addDays, subDays, parse } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import sampleEventsContent from "@/app/lib/eventData";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import { cn } from "@/app/lib/utils";
import CalendarDayView from "./views/CalendarDayView";
import CalendarWeekView from "./views/CalendarWeekView";
import { flushSync } from "react-dom";
import EventDetailModal from "./EventDetailModal";
import type { KanbanEvent, ModalData, CustomDragState, OriginRect, DebugInfo, CalendarContainerProps } from "@/app/types/calendar";
import { EDGE_ZONE_WIDTH_PERCENTAGE, TRANSITION_COOLDOWN, EDGE_HOLD_DURATION } from "@/app/lib/constants";

// Helper to get sample content randomly
const sampleTitles = Object.values(sampleEventsContent).flat().map(e => e.title);
const sampleDescriptions = Object.values(sampleEventsContent).flat().map(e => e.description);
const sampleImages = Object.values(sampleEventsContent).flat().map(e => e.imageUrl);
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper function to sort events by time
const sortEventsByTime = (events: KanbanEvent[]): KanbanEvent[] => {
  return [...events].sort((a, b) => {
    try {
      // Parse the time strings like "08:30 AM" to Date objects for comparison
      const timeA = parse(a.time, 'hh:mm a', new Date());
      const timeB = parse(b.time, 'hh:mm a', new Date());
      return timeA.getTime() - timeB.getTime();
    } catch (e) {
      // Fallback if parsing fails
      return a.time.localeCompare(b.time);
    }
  });
};

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
  edgeHoldTimer: null as NodeJS.Timeout | null, // Renamed for clarity
  isInEdgeZone: false, // Track if currently in *any* edge zone
  dragInitiated: false, // Track if drag has been initiated
  dragThreshold: 5, // Minimum pixel movement to initiate drag
  initialPosition: { x: 0, y: 0 }, // Initial position for threshold calculation
  inDesktopWeekView: false, // Track if we're in desktop week view
  dropZoneElement: null as HTMLElement | null, // Store the current drop zone element
  cursorOverlayPosition: { x: 0, y: 0 }, // Store the cursor position relative to the overlay
};

// Improved overlay update function that coordinates with React state
function updateGlobalOverlayPosition() {
  if (!globalDragTracking.activeOverlay || !globalDragTracking.isTracking) return;
  
  const { x, y } = globalDragTracking.currentPosition;
  
  // Apply position with transform for better performance - center under finger or cursor
  if (globalDragTracking.activeOverlay) {
    const cardElement = globalDragTracking.activeOverlay.querySelector('div');
    if (cardElement) {
      const cardWidth = cardElement.offsetWidth;
      const cardHeight = cardElement.offsetHeight;
      
      // Position so finger/cursor is at the right position
      // Use cursor offset for mouse (desktop) interactions
      const posX = x - globalDragTracking.cursorOverlayPosition.x;
      const posY = y - globalDragTracking.cursorOverlayPosition.y;
      
      globalDragTracking.activeOverlay.style.transform = 
        `translate3d(${posX}px, ${posY}px, 0)`;
    }
  }

  // Update the last detected column based on cursor position
  if (globalDragTracking.isTracking && !globalDragTracking.inTransition) {
    // Find column under cursor
    const elementsAtPoint = document.elementsFromPoint(x, y);
    const columnElement = elementsAtPoint.find(el => 
      el.hasAttribute('data-date') || el.closest('[data-date]')
    );
    
    if (columnElement) {
      const dateAttr = columnElement.getAttribute('data-date') || 
                       columnElement.closest('[data-date]')?.getAttribute('data-date');
      if (dateAttr) {
        globalDragTracking.lastDetectedColumn = dateAttr;
        // Update the drop zone element
        globalDragTracking.dropZoneElement = (columnElement.closest('[data-date]') as HTMLElement) || (columnElement as HTMLElement);
      }
    }
  }

  // Edge detection logic with hold requirement
  if (globalDragTracking.isTracking && 
      !globalDragTracking.inTransition && 
      globalDragTracking.edgeDetectionEnabled) {
    // Get container bounds for edge detection
    const container = document.querySelector('.calendar-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
      
      const atLeftEdge = x < containerRect.left + edgeWidth;
      const atRightEdge = x > containerRect.right - edgeWidth;
      const currentlyAtEdge = atLeftEdge || atRightEdge;
      const edgeDirection = atLeftEdge ? 'left' : (atRightEdge ? 'right' : null);

      // User entered an edge zone
      if (currentlyAtEdge && !globalDragTracking.isInEdgeZone && !globalDragTracking.edgeHoldTimer) {
        console.log(`[Edge Detection] Entered edge zone: ${edgeDirection}. Starting ${EDGE_HOLD_DURATION}ms timer.`);
        globalDragTracking.isInEdgeZone = true;
        
        // Start the hold timer
        globalDragTracking.edgeHoldTimer = setTimeout(() => {
          console.log("[Edge Timer Callback] Timer fired."); 
          
          // Timer completed. Check if STILL in an edge zone 
          const currentX = globalDragTracking.currentPosition.x;
          const container = document.querySelector('.calendar-container');
          if (container) {
              const containerRectNow = container.getBoundingClientRect();
              const edgeWidthNow = containerRectNow.width * EDGE_ZONE_WIDTH_PERCENTAGE;
              const stillAtLeft = currentX < containerRectNow.left + edgeWidthNow;
              const stillAtRight = currentX > containerRectNow.right - edgeWidthNow;
              const finalEdgeDirection = stillAtLeft ? 'left' : (stillAtRight ? 'right' : null);
              
              console.log(`[Edge Timer Callback] PosCheck: currentX: ${currentX}, LeftBoundary: ${containerRectNow.left + edgeWidthNow}, RightBoundary: ${containerRectNow.right - edgeWidthNow}, FinalDirection: ${finalEdgeDirection}`); 
    
              if (finalEdgeDirection) {
                 console.log(`[Edge Timer Callback] Condition met. Dispatching edgeDetected: ${finalEdgeDirection}`);
                 document.dispatchEvent(new CustomEvent('edgeDetected', { 
                    detail: { edge: finalEdgeDirection } 
                 }));
              } else {
                 console.log("[Edge Timer Callback] Condition failed: Not in edge zone upon timer completion.");
              }
          } else {
              console.warn("[Edge Timer Callback] Container not found during check.");
          }
          
          // Reset timer reference and zone state AFTER check
          globalDragTracking.edgeHoldTimer = null;
          globalDragTracking.isInEdgeZone = false; 

        }, EDGE_HOLD_DURATION);
      }
      // User left the edge zone - ONLY reset the flag, DO NOT clear the timer
      else if (!currentlyAtEdge && globalDragTracking.isInEdgeZone) {
        console.log("[Edge Detection] Left edge zone (timer might still be running). Resetting isInEdgeZone flag.");
        globalDragTracking.isInEdgeZone = false;
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
  
  // Get computed style to find current transform
  const style = window.getComputedStyle(globalDragTracking.activeOverlay);
  const matrix = new DOMMatrix(style.transform);
  const startX = matrix.m41; // translateX value
  const startY = matrix.m42; // translateY value
  
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

const CalendarContainer = ({ currentDate, view, onDateChange }: CalendarContainerProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [allEvents, setAllEvents] = useState<KanbanEvent[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // SIMPLIFIED State for Event Detail Modal
  const [modalData, setModalData] = useState<ModalData | null>(null);
  
  // Custom drag tracking state
  const [customDragState, setCustomDragState] = useState<{
    isDragging: boolean;
    event: KanbanEvent | null;
    position: { x: number, y: number } | null;
    startedOn: string | null;
    currentlyHovering: 'left' | 'right' | null;
    dropTargetId: string | null; // No longer used for reordering, but keeping for compatibility
    dragStartTime: number | null; // Track when drag started for threshold timing
  }>({
    isDragging: false,
    event: null,
    position: null,
    startedOn: null,
    currentlyHovering: null,
    dropTargetId: null,
    dragStartTime: null
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
  const triggerDateChangeRef = useRef<(direction: 'left' | 'right') => void>();
  const finalizeCustomDragRef = useRef<() => void>();
  const reactSyncRef = useRef({
    lastStateUpdate: 0,
    targetDateAfterTransition: null as string | null,
    dropRequested: false,
    pendingUpdate: false
  });
  const prevDateAnimRef = useRef<{ date: Date | null, direction: 'left' | 'right' | null }>({ date: null, direction: null });

  // NEW Refs for timer-based edge transition
  const edgeHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const edgeHoverDirectionRef = useRef<'left' | 'right' | null>(null);

  // NEW: Refs for mouse drag state
  const mouseStateRef = useRef({
    mouseDownEvent: null as MouseEvent | null,
    originalTargetRect: null as DOMRect | null,
    originalEvent: null as KanbanEvent | null,
    dragThresholdMet: false,
    dragStarted: false,
    mouseDownTarget: null as HTMLElement | null,
  });

  // --- Computed Values --- 
  const effectiveView = isMobile ? "day" : view;

  // Update global state about view
  useEffect(() => {
    globalDragTracking.inDesktopWeekView = !isMobile && view === "week";
  }, [isMobile, view]);

  // Get time-sorted events for each view
  const filteredEvents = useMemo(() => {
    if (effectiveView === "day") {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const dayEvents = allEvents.filter(event => event.date === dateStr);
      return sortEventsByTime(dayEvents); // Sort day events by time
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

  // Get time-sorted events by date for week view
  const eventsByDateForWeek = useMemo(() => {
    if (effectiveView !== "week") return {};
    
    const grouped: { [date: string]: KanbanEvent[] } = {};
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    
    // First, ensure all dates in the week have an entry (even if empty)
    eachDayOfInterval({ start: weekStart, end: weekEnd }).forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      grouped[dateStr] = [];
    });
    
    // Then populate with events
    filteredEvents.forEach(event => {
      if (!grouped[event.date]) { 
        grouped[event.date] = []; 
      }
      grouped[event.date].push(event);
    });
    
    // Sort events by time for each day
    Object.keys(grouped).forEach(date => {
      grouped[date] = sortEventsByTime(grouped[date]);
    });
    
    return grouped;
  }, [filteredEvents, currentDate, effectiveView]);

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
    globalDragTracking.dragInitiated = false;
    
    // Stop animation frame
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }
    
    const currentDateStr = format(currentDate, "yyyy-MM-dd");
    let targetDateStr = currentDateStr;
    
    // Use the last detected column from global tracking
    if (globalDragTracking.lastDetectedColumn) {
      targetDateStr = globalDragTracking.lastDetectedColumn;
      console.log(`Using last detected column: ${targetDateStr}`);
    }
    
    const droppedEvent = customDragState.event;
    
    console.log(`Moving event "${droppedEvent.title}" to ${targetDateStr}`);
    
    globalDragTracking.synchronizingWithReact = true;
    reactSyncRef.current.lastStateUpdate = Date.now();
    
    flushSync(() => {
      // Update the event with new date
      const eventsWithoutDragged = allEvents.filter(e => e.id !== droppedEvent.id);
      const updatedEvent = { ...droppedEvent, date: targetDateStr };
      
      // Add back to the events array
      const newEvents = [...eventsWithoutDragged, updatedEvent];
      setAllEvents(newEvents);
      
      // Reset drag state
      setCustomDragState({
        isDragging: false, 
        event: null, 
        position: null, 
        startedOn: null, 
        currentlyHovering: null, 
        dropTargetId: null,
        dragStartTime: null
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

  }, [customDragState, currentDate, allEvents]);
  
  const triggerDateChange = useCallback((direction: 'left' | 'right') => {
    if (isTransitioningRef.current || globalDragTracking.inTransition) return;
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < TRANSITION_COOLDOWN) return;
    
    console.log(`Triggering date change to ${direction}`);
    isTransitioningRef.current = true;
    globalDragTracking.inTransition = true;
    lastTransitionTimeRef.current = now;
    globalDragTracking.edgeDetectionEnabled = false;
    
    // Clear edge hold timer if transition starts
    if (edgeHoldTimerRef.current) {
        console.log("[triggerDateChange] Clearing edge hold timer.");
        clearTimeout(edgeHoldTimerRef.current);
        edgeHoldTimerRef.current = null;
    }
    edgeHoverDirectionRef.current = null; // Reset hover direction state

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
        // Reset edge timer state
        edgeHoverDirectionRef.current = null;
        if (edgeHoldTimerRef.current) {
           clearTimeout(edgeHoldTimerRef.current);
           edgeHoldTimerRef.current = null;
        } 
      }, TRANSITION_COOLDOWN);
      
    }, 300);
  }, [customDragState, currentDate, onDateChange, finalizeCustomDrag]);

  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number, targetElement?: HTMLElement) => {
    // Reset state
    dayOffsetRef.current = 0;
    isTransitioningRef.current = false;
    globalDragTracking.inTransition = false;
    globalDragTracking.synchronizingWithReact = false;
    globalDragTracking.dropPending = false;
    globalDragTracking.lastDetectedColumn = event.date;
    globalDragTracking.initialPosition = { x: clientX, y: clientY };
    globalDragTracking.dragInitiated = true;
    
    // Reset edge detection state
    globalDragTracking.edgeDetectionEnabled = true;
    if (edgeHoldTimerRef.current) { 
      clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
    }
    edgeHoverDirectionRef.current = null;
    
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
      
      // Find the original card element if not provided
      const originalCard = targetElement || document.querySelector(`[data-event-id="${event.id}"]`);
      
      if (originalCard) {
        const originalRect = originalCard.getBoundingClientRect();
        globalDragTracking.targetElement = originalCard as HTMLElement;
        
        // Calculate cursor position relative to card for more accurate dragging
        // This is especially important for mouse dragging (desktop)
        const cursorOffsetX = clientX - originalRect.left;
        const cursorOffsetY = clientY - originalRect.top;
        
        // Store the cursor position relative to the overlay for future updates
        globalDragTracking.cursorOverlayPosition = { x: cursorOffsetX, y: cursorOffsetY };
        
        // Position overlay at original card position first
        globalDragTracking.activeOverlay.style.transform = `translate3d(${originalRect.left}px, ${originalRect.top}px, 0)`;
        
        // Then animate to cursor position
        setTimeout(() => {
          if (globalDragTracking.activeOverlay) {
            globalDragTracking.activeOverlay.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
            
            // Calculate position based on cursor offset
            const posX = clientX - cursorOffsetX;
            const posY = clientY - cursorOffsetY;
            
            globalDragTracking.activeOverlay.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
            
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
        // Fallback if original card not found
        const cardElement = globalDragTracking.activeOverlay?.querySelector('div');
        if (cardElement) {
          const cardWidth = cardElement.offsetWidth;
          const cardHeight = cardElement.offsetHeight;
          
          // Default to center positioning if we can't find the original
          globalDragTracking.cursorOverlayPosition = { 
            x: cardWidth / 2, 
            y: cardHeight / 2 
          };
          
          globalDragTracking.activeOverlay.style.transform = `translate3d(${clientX - (cardWidth / 2)}px, ${clientY - (cardHeight / 2)}px, 0)`;
        }
        if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
        globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
      }
      
      // Provide haptic feedback
      if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
    }
    
    // Update React state
    setCustomDragState({
      isDragging: true, 
      event: event, 
      position: { x: clientX, y: clientY }, 
      startedOn: event.date, 
      currentlyHovering: null, 
      dropTargetId: null,
      dragStartTime: Date.now()
    });
    
    // Disable page scrolling during drag
    document.body.style.overflow = 'hidden';
    document.body.classList.add('calendar-dragging');
    
    console.log("Drag started ...", clientX, clientY);
  }, []);

  // Improved mouse event handlers specifically for desktop dragging
  const handleEventMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      // Touch event handling (mobile)
      e.stopPropagation();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      console.log("Starting touch drag at", clientX, clientY);
      startCustomDrag(event, clientX, clientY, e.currentTarget as HTMLElement);
    } else {
      // Mouse event handling (desktop)
      e.preventDefault();
      e.stopPropagation();
      
      // Store the initial state for potential drag
      const mouseEvent = e.nativeEvent as MouseEvent;
      mouseStateRef.current = {
        mouseDownEvent: mouseEvent,
        originalTargetRect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
        mouseDownTarget: e.currentTarget as HTMLElement,
        originalEvent: event,
        dragThresholdMet: false,
        dragStarted: false
      };
      
      console.log("Mouse down on event, waiting for drag threshold");
      
      // We'll initiate the actual drag in the mousemove handler once threshold is met
    }
  }, [startCustomDrag]);

  // --- Event Detail Modal Handlers (Simplified) --- 
  const handleEventCardClick = useCallback((event: KanbanEvent, cardElement: HTMLElement) => {
    if (customDragState.isDragging) return;
    
    // If we've moved the mouse, it's a drag attempt, not a click
    if (mouseStateRef.current.dragThresholdMet) return;
    
    const rect = cardElement.getBoundingClientRect();
    // Set combined modal data state
    setModalData({ 
      event: event, 
      originRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scrollY: window.scrollY }
    });
    document.body.style.overflow = 'hidden'; 
  }, [customDragState.isDragging]);

  const closeDetailView = useCallback(() => {
    // Set modal data state back to null to close
    setModalData(null);
    document.body.style.overflow = ''; 
  }, []);

  // handleEventClick uses the simplified handlers
  const handleEventClick = useCallback((event: KanbanEvent, cardElement?: HTMLElement) => {
     if (customDragState.isDragging) return;
     
     // If we've moved the mouse, it's a drag attempt, not a click
     if (mouseStateRef.current.dragThresholdMet) return;
     
     let element = cardElement;
     if (!element) {
       element = document.querySelector(`[data-event-id="${event.id}"]`) as HTMLElement;
     }
     if (element) {
       handleEventCardClick(event, element);
     } else {
       // Fallback: Element not found, log error and do not open modal
       console.error('Event card element not found. Cannot open detail view.'); 
     }
  }, [customDragState.isDragging, handleEventCardClick]);
  
  // cancelCustomDrag remains the same
  const cancelCustomDrag = useCallback(() => {
    if (!customDragState.isDragging) return;
    console.log("Cancelling drag (e.g., Escape key)");
    // Stop global tracking immediately
    globalDragTracking.isTracking = false;
    globalDragTracking.dragInitiated = false;
    
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
    setCustomDragState({ 
      isDragging: false, 
      event: null, 
      position: null, 
      startedOn: null, 
      currentlyHovering: null, 
      dropTargetId: null,
      dragStartTime: null
    });
    
    // Reset mouse state
    mouseStateRef.current = {
      mouseDownEvent: null,
      originalTargetRect: null,
      originalEvent: null,
      dragThresholdMet: false,
      dragStarted: false,
      mouseDownTarget: null,
    };
    
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
    // Clear edge hold timer on cancel
    if (edgeHoldTimerRef.current) {
      console.log("[cancelCustomDrag] Clearing edge hold timer.");
      clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
    }
    edgeHoverDirectionRef.current = null;
    globalDragTracking.isInEdgeZone = false;
  }, [customDragState.isDragging]); // Dependency on isDragging ensures latest state

  // Handle keyboard events (e.g., Escape to cancel drag)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && customDragState.isDragging) {
        cancelCustomDrag();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelCustomDrag, customDragState.isDragging]);

  // --- UseEffect Hooks --- 

  useEffect(() => {
    // Overlay initialization logic
    const createOverlay = () => {
      if (globalDragTracking.activeOverlay) {
        try { document.body.removeChild(globalDragTracking.activeOverlay); } catch (e) {}
      }
      if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'global-drag-overlay';
      Object.assign(overlayDiv.style, { 
        position: 'fixed', 
        pointerEvents: 'none', 
        zIndex: '9999', 
        top: '0', 
        left: '0', 
        display: 'none', 
        transformOrigin: 'center center', 
        willChange: 'transform', 
        backfaceVisibility: 'hidden' 
      });
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
  
  // Specifically handle mouse events for drag initiation and tracking
  useEffect(() => {
    // This handler initiates drag after threshold is met
    const handleMouseMove = (e: MouseEvent) => {
      // If no mouse down event, we're not tracking
      if (!mouseStateRef.current.mouseDownEvent || mouseStateRef.current.dragStarted) return;
      
      // Calculate distance moved
      const initialX = mouseStateRef.current.mouseDownEvent.clientX;
      const initialY = mouseStateRef.current.mouseDownEvent.clientY;
      const deltaX = e.clientX - initialX;
      const deltaY = e.clientY - initialY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Check if we've met the drag threshold
      if (distance >= globalDragTracking.dragThreshold) {
        mouseStateRef.current.dragThresholdMet = true;
        
        // Only start drag if not already started and we have the event and target
        if (!mouseStateRef.current.dragStarted && mouseStateRef.current.originalEvent && mouseStateRef.current.mouseDownTarget) {
          mouseStateRef.current.dragStarted = true;
          console.log("Mouse drag threshold met. Starting drag.");
          
          // Start the drag
          startCustomDrag(
            mouseStateRef.current.originalEvent, 
            e.clientX, 
            e.clientY,
            mouseStateRef.current.mouseDownTarget
          );
        }
      }
    };
    
    // This handler finalizes the drag on mouse up
    const handleMouseUp = (e: MouseEvent) => {
      // If drag threshold was met, finalize the drag
      if (mouseStateRef.current.dragThresholdMet && customDragState.isDragging) {
        console.log("Mouse up after drag. Finalizing.");
        finalizeCustomDrag();
      }
      
      // Reset mouse state
      mouseStateRef.current = {
        mouseDownEvent: null,
        originalTargetRect: null,
        originalEvent: null,
        dragThresholdMet: false,
        dragStarted: false,
        mouseDownTarget: null,
      };
    };
    
    // This handler cancels the drag tracking on mouse leave
    const handleMouseLeave = (e: MouseEvent) => {
      // Only reset tracking state, don't cancel active drags
      if (!customDragState.isDragging) {
        mouseStateRef.current = {
          mouseDownEvent: null,
          originalTargetRect: null,
          originalEvent: null,
          dragThresholdMet: false,
          dragStarted: false,
          mouseDownTarget: null,
        };
      }
    };
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [customDragState.isDragging, finalizeCustomDrag, startCustomDrag]);
  
  useEffect(() => {
    if (!customDragState.isDragging) return;
    console.log("Setting up global POINTER event handlers for drag (with stabilized finalize ref)");
    
    const handlePointerMove = (e: PointerEvent) => {
       globalDragTracking.currentPosition = { x: e.clientX, y: e.clientY };
       // Update visual position state immediately
       setCustomDragState(prev => ({ ...prev, position: { x: e.clientX, y: e.clientY } }));
      
       // Edge hover logic + Timer management
       if (!isTransitioningRef.current && !globalDragTracking.inTransition && globalDragTracking.edgeDetectionEnabled && effectiveView === 'day') {
          const container = document.querySelector('.calendar-container');
          const containerRect = container ? container.getBoundingClientRect() : containerRef.current?.getBoundingClientRect();
          
          if (containerRect) {
              const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
              const leftEdgeBoundary = containerRect.left + edgeWidth;
              const rightEdgeBoundary = containerRect.right - edgeWidth;
              let currentEdge: 'left' | 'right' | null = null;
              if (e.clientX < leftEdgeBoundary) currentEdge = 'left';
              else if (e.clientX > rightEdgeBoundary) currentEdge = 'right';
              
              // Update visual hover state
              if (currentEdge !== customDragState.currentlyHovering) {
                 setCustomDragState(prev => ({ ...prev, currentlyHovering: currentEdge }));
                 if (currentEdge && navigator.vibrate) {
                     navigator.vibrate(10); // Vibrate on entering edge zone
                 }
              }

              // Timer logic based on edge state change
              if (currentEdge !== edgeHoverDirectionRef.current) {
                  console.log(`Edge hover changed: ${edgeHoverDirectionRef.current} -> ${currentEdge}`);
                  // Clear existing timer whenever edge state changes
                  if (edgeHoldTimerRef.current) {
                      console.log("Clearing existing edge hold timer due to state change.");
                      clearTimeout(edgeHoldTimerRef.current);
                      edgeHoldTimerRef.current = null;
                  }
                  
                  edgeHoverDirectionRef.current = currentEdge; // Update tracked edge direction

                  // If we entered a NEW edge zone, start the timer
                  if (currentEdge) {
                      console.log(`Starting ${EDGE_HOLD_DURATION}ms timer for edge: ${currentEdge}`);
                      edgeHoldTimerRef.current = setTimeout(() => {
                          const currentTrackedEdge = edgeHoverDirectionRef.current; // Capture edge direction at timer start
                          console.log(`[Edge Timer Callback - ${currentTrackedEdge}] Timer fired.`);
                          
                          // Check flags AGAIN before triggering
                          if (!isTransitioningRef.current && !globalDragTracking.inTransition && globalDragTracking.edgeDetectionEnabled) {
                              // Re-check current position *now*
                              const currentX = globalDragTracking.currentPosition.x;
                              const container = document.querySelector('.calendar-container');
                              if (container) {
                                const containerRectNow = container.getBoundingClientRect();
                                const edgeWidthNow = containerRectNow.width * EDGE_ZONE_WIDTH_PERCENTAGE;
                                const stillAtLeft = currentX < containerRectNow.left + edgeWidthNow;
                                const stillAtRight = currentX > containerRectNow.right - edgeWidthNow;
                                const finalEdgeDirection = stillAtLeft ? 'left' : (stillAtRight ? 'right' : null);

                                console.log(`[Edge Timer Callback - ${currentTrackedEdge}] PosCheck: currentX: ${currentX}, FinalDirection: ${finalEdgeDirection}`); 

                                // Check if still at the edge the timer was started for
                                if (finalEdgeDirection === currentTrackedEdge) {
                                    console.log(`[Edge Timer Callback - ${currentTrackedEdge}] Flags & Position OK. Triggering change.`);
                                    if (triggerDateChangeRef.current && currentTrackedEdge) {
                                       triggerDateChangeRef.current(currentTrackedEdge);
                                    } else if (!currentTrackedEdge) {
                                        console.warn("[Edge Timer Callback] Tracked edge was null, cannot trigger transition.")
                                    }
                                } else {
                                     console.log(`[Edge Timer Callback - ${currentTrackedEdge}] Condition failed: Moved out of original edge zone (${finalEdgeDirection}).`);
                                }
                              } else {
                                 console.warn("[Edge Timer Callback] Container not found during check.");
                              }
                          } else {
                              console.log(`[Edge Timer Callback - ${currentTrackedEdge}] Transition blocked by flags.`);
                          }
                          edgeHoldTimerRef.current = null; // Timer finished
                          // Don't reset edgeHoverDirectionRef here, let the next move handle it
                      }, EDGE_HOLD_DURATION);
                  }
              }
          }
      }
    };
    
    const handlePointerEnd = (e: PointerEvent) => {
      console.log(`%cPOINTER END EVENT DETECTED: ${e.type}`, "color: red; font-weight: bold;");
      // Clear edge hold timer on drop/cancel
      if (edgeHoldTimerRef.current) {
         console.log("[handlePointerEnd] Clearing edge hold timer.");
         clearTimeout(edgeHoldTimerRef.current);
         edgeHoldTimerRef.current = null;
      }
      edgeHoverDirectionRef.current = null;
      
      if (!globalDragTracking.isTracking) return;
      if (isTransitioningRef.current || globalDragTracking.inTransition) {
        console.log("%cPointer up/cancel during transition - marking drop as pending.", "color: orange;");
        globalDragTracking.dropPending = true;
        return;
      }
      
      // Only finalize for touch events - mouse events are handled separately
      if (e.pointerType === 'touch') {
        console.log("%cFinalizing drag immediately on pointer event:", "color: green;", e.type);
        if (finalizeCustomDragRef.current) {
            finalizeCustomDragRef.current(); 
        }
      }
    };
    
    // Listener setup
    document.addEventListener('pointermove', handlePointerMove, { capture: true });
    document.addEventListener('pointerup', handlePointerEnd, { capture: true });
    document.addEventListener('pointercancel', handlePointerEnd, { capture: true });
    document.body.style.userSelect = 'none';
    
    // Cleanup
    return () => {
      console.log("Removing global POINTER event handlers for drag");
      document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      document.removeEventListener('pointerup', handlePointerEnd, { capture: true });
      document.removeEventListener('pointercancel', handlePointerEnd, { capture: true });
      document.body.style.userSelect = '';
       if (edgeHoldTimerRef.current) {
          console.log("[useEffect Cleanup] Clearing edge hold timer.");
          clearTimeout(edgeHoldTimerRef.current);
          edgeHoldTimerRef.current = null;
       }
       edgeHoverDirectionRef.current = null;
    };
   }, [customDragState.isDragging, effectiveView]);

  useEffect(() => {
    finalizeCustomDragRef.current = finalizeCustomDrag;
  }, [finalizeCustomDrag]);

  useEffect(() => {
    triggerDateChangeRef.current = triggerDateChange;
  }, [triggerDateChange]);

  useEffect(() => {
    prevDateAnimRef.current = { ...prevDateAnimRef.current, date: currentDate };
  }, [currentDate]);
  
  // Generate random events when component mounts
  useEffect(() => {
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

  // Force isDragging to false immediately after mount
  useEffect(() => {
    console.log("[Mount Effect] Forcing isDragging: false");
    setCustomDragState(prev => ({ ...prev, isDragging: false }));
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

  // Debug log for dragging state
  console.log("CalendarContainer render - isDragging:", customDragState.isDragging);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-white rounded-b-astral shadow-sm border border-slate-100 border-t-0 flex-1 flex flex-col relative calendar-container overflow-hidden", // Added overflow-hidden
        customDragState.isDragging && "touch-none"
      )}
    >
      {/* Status indicator for drag operation */}
      {customDragState.isDragging && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-500 h-1 animate-pulse" 
             aria-hidden="true"
        ></div>
      )}
      
      {/* Visual indicator for desktop drag operation */}
      {customDragState.isDragging && globalDragTracking.inDesktopWeekView && (
        <div 
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg"
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          Drop to move event
        </div>
      )}
      
      {/* Temporarily removed AnimatePresence and motion.div for layout debugging */}
      <div className="h-full w-full flex-1 flex flex-col"> {/* Added flex properties */} 
        {effectiveView === 'week' && (
          <CalendarWeekView
            currentDate={currentDate}
            eventsByDate={eventsByDateForWeek}
            customDragState={customDragState}
            onEventClick={handleEventClick} 
            onEventMouseDown={handleEventMouseDown} 
          />
        )}
        {effectiveView === 'day' && (
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
      </div>

      {/* Event Detail Modal Component */}
      <EventDetailModal 
        event={modalData?.event ?? null} // Pass event from modalData
        isOpen={!!modalData} // Modal is open if modalData is not null
        onClose={closeDetailView}
        originRect={modalData?.originRect ?? null} // Pass originRect from modalData
      />
    </div>
  );
};

export default CalendarContainer;