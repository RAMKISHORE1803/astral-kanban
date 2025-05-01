"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addHours, addDays, subDays } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { KanbanEvent } from "@/app/lib/utils";
import EventCard from "./EventCard";
import EventDetail from "./EventDetail";
import sampleEventsContent from "@/app/lib/eventData";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import { cn } from "@/app/lib/utils";
import CalendarDayView from "./CalendarDayView";
import CalendarWeekView from "./CalendarWeekView";

// Helper to get sample content randomly
const sampleTitles = Object.values(sampleEventsContent).flat().map(e => e.title);
const sampleDescriptions = Object.values(sampleEventsContent).flat().map(e => e.description);
const sampleImages = Object.values(sampleEventsContent).flat().map(e => e.imageUrl);
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Constants for edge detection
const EDGE_ZONE_WIDTH_PERCENTAGE = 0.2; // 20% of screen width for edge detection
const TRANSITION_COOLDOWN = 300; // ms to wait before allowing another transition

// Add a global state to ensure drag tracking always works
let globalDragTracking = {
  activeOverlay: null as HTMLDivElement | null,
  isTracking: false,
  currentPosition: { x: 0, y: 0 },
  animationFrame: null as number | null,
  offsetX: 150, // Half card width
  offsetY: 30,  // Small offset for visibility
};

// Overlay update function that works independently of React's lifecycle
function updateGlobalOverlayPosition() {
  if (!globalDragTracking.activeOverlay || !globalDragTracking.isTracking) return;
  
  const { x, y } = globalDragTracking.currentPosition;
  
  // Apply position with transform for better performance
  globalDragTracking.activeOverlay.style.transform = 
    `translate3d(${x - globalDragTracking.offsetX}px, ${y - globalDragTracking.offsetY}px, 0)`;
  
  // Continue the animation loop
  globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
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
  const prevDateRef = useRef<Date>(currentDate);
  
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
  
  // Forward declaration refs to solve circular dependencies
  const updateDragPositionRef = useRef<(clientX: number, clientY: number) => void>();
  const triggerDateChangeRef = useRef<(direction: 'left' | 'right') => void>();
  const finalizeCustomDragRef = useRef<() => void>();
  
  // Move computed values to the top
  const effectiveView = isMobile ? "day" : view;

  // Filter events based on the current view and date
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

  // Group events by date for week view rendering
  const eventsByDateForWeek = useMemo(() => {
    if (effectiveView !== "week") return {};
    const grouped: { [date: string]: KanbanEvent[] } = {};
    filteredEvents.forEach(event => {
      if (!grouped[event.date]) { grouped[event.date] = []; }
      grouped[event.date].push(event);
    });
    return grouped;
  }, [filteredEvents, effectiveView]);
  
  // Initialize draggable overlay as a DOM element outside React - completely isolated
  useEffect(() => {
    // Create a stable overlay that won't be affected by React rendering
    const createOverlay = () => {
      // Clean up any existing overlay
      if (globalDragTracking.activeOverlay) {
        try {
          document.body.removeChild(globalDragTracking.activeOverlay);
        } catch (e) {
          // Handle potential errors if element was already removed
          console.log("Overlay cleanup error (safe to ignore):", e);
        }
      }
      
      // Cancel any existing animation frame
      if (globalDragTracking.animationFrame) {
        cancelAnimationFrame(globalDragTracking.animationFrame);
        globalDragTracking.animationFrame = null;
      }
      
      // Create a new overlay div
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'global-drag-overlay';
      overlayDiv.style.position = 'fixed';
      overlayDiv.style.pointerEvents = 'none';
      overlayDiv.style.zIndex = '9999';
      overlayDiv.style.top = '0';
      overlayDiv.style.left = '0';
      overlayDiv.style.display = 'none';
      overlayDiv.style.transformOrigin = 'center center';
      overlayDiv.style.willChange = 'transform';
      overlayDiv.style.backfaceVisibility = 'hidden'; // Prevent paint flickering
      overlayDiv.setAttribute('aria-hidden', 'true');
      
      // Add to document body - outside React's control
      document.body.appendChild(overlayDiv);
      globalDragTracking.activeOverlay = overlayDiv;
      globalDragTracking.isTracking = false;
    };
    
    // Initialize the overlay
    createOverlay();
    
    // Event handlers for global tracking that will persist regardless of React state
    const globalPointerMove = (e: PointerEvent) => {
      if (globalDragTracking.isTracking) {
        // Update position regardless of React rendering or transitions
        globalDragTracking.currentPosition = {
          x: e.clientX,
          y: e.clientY
        };
        
        // Ensure animation frame is running
        if (!globalDragTracking.animationFrame) {
          globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
        }
      }
    };
    
    // Add pointer move listener at the document level
    document.addEventListener('pointermove', globalPointerMove, { passive: true });
    
    // Clean up on component unmount
    return () => {
      document.removeEventListener('pointermove', globalPointerMove);
      
      if (globalDragTracking.animationFrame) {
        cancelAnimationFrame(globalDragTracking.animationFrame);
        globalDragTracking.animationFrame = null;
      }
      
      if (globalDragTracking.activeOverlay) {
        try {
          document.body.removeChild(globalDragTracking.activeOverlay);
        } catch (e) {
          console.log("Cleanup error (safe to ignore):", e);
        }
        globalDragTracking.activeOverlay = null;
      }
      
      globalDragTracking.isTracking = false;
    };
  }, []);
  
  // Start dragging an event - using the global overlay system
  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number) => {
    // Reset day offset counter
    dayOffsetRef.current = 0;
    
    // Reset transition state
    isTransitioningRef.current = false;
    
    // Update global tracking state
    globalDragTracking.isTracking = true;
    globalDragTracking.currentPosition = { x: clientX, y: clientY };
    
    // Set up the overlay with the event card content
    if (globalDragTracking.activeOverlay) {
      // Clear any existing content
      globalDragTracking.activeOverlay.innerHTML = '';
      
      // Create the event card with proper styling
      const eventCardHtml = `
        <div class="bg-white rounded-lg border border-slate-200 shadow-lg p-3 w-[300px]" 
             style="transform: scale(0.96) rotate(1deg); opacity: 0.95; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15); outline: 2px solid rgba(59, 130, 246, 0.5);">
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
      
      // Start animation loop
      if (globalDragTracking.animationFrame) {
        cancelAnimationFrame(globalDragTracking.animationFrame);
      }
      globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
    }
    
    // Set the React state
    setCustomDragState({
      isDragging: true,
      event: event,
      position: { x: clientX, y: clientY },
      startedOn: event.date,
      currentlyHovering: null,
      dropTargetId: null
    });
    
    // Prevent scrolling during drag
    document.body.style.overflow = 'hidden';
    document.body.classList.add('calendar-dragging');
    
    // Clear any selected event
    setSelectedEvent(null);
    
    console.log("Drag started", clientX, clientY);
  }, []);
  
  // Finalize drag operation - using the global overlay system
  const finalizeCustomDrag = useCallback(() => {
    if (!customDragState.isDragging || !customDragState.event) {
      return;
    }
    
    // Stop global tracking
    globalDragTracking.isTracking = false;
    
    // Stop animation frame
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }
    
    // Hide the overlay
    if (globalDragTracking.activeOverlay) {
      // Create a nice fade-out effect
      globalDragTracking.activeOverlay.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      globalDragTracking.activeOverlay.style.opacity = '0';
      globalDragTracking.activeOverlay.style.transform = `translate3d(${globalDragTracking.currentPosition.x - globalDragTracking.offsetX}px, ${globalDragTracking.currentPosition.y - globalDragTracking.offsetY}px, 0) scale(0.9)`;
      
      // After animation completes, reset the overlay
      setTimeout(() => {
        if (globalDragTracking.activeOverlay) {
          globalDragTracking.activeOverlay.style.display = 'none';
          globalDragTracking.activeOverlay.style.transition = '';
          globalDragTracking.activeOverlay.style.opacity = '1';
          globalDragTracking.activeOverlay.style.transform = '';
        }
      }, 200);
    }
    
    // Update the events data based on where we dropped
    const targetDateStr = format(currentDate, "yyyy-MM-dd");
    const droppedEvent = customDragState.event;
    const dropTargetId = customDragState.dropTargetId;
    
    // Handle positioning and reordering logic
    if (dropTargetId) {
      const targetEvent = allEvents.find(e => e.id === dropTargetId);
      if (targetEvent) {
        setAllEvents(prevEvents => {
          // Remove the dragged event from its current position
          const withoutDragged = prevEvents.filter(e => e.id !== droppedEvent.id);
          
          // Find the target position
          const targetIndex = withoutDragged.findIndex(e => e.id === targetEvent.id);
          
          if (targetIndex === -1) return prevEvents; // Safety check
          
          // Create an updated event with the new date if moving between days
          const updatedEvent = targetEvent.date !== droppedEvent.date 
            ? { ...droppedEvent, date: targetEvent.date }
            : { ...droppedEvent };
          
          // Insert the event at the target position
          const result = [...withoutDragged];
          result.splice(targetIndex, 0, updatedEvent);
          return result;
        });
      }
    }
    // Simple date change without specific reordering
    else if (customDragState.startedOn !== targetDateStr) {
      setAllEvents(prev => {
        // Find all events in the target day
        const targetDayEvents = prev.filter(e => e.date === targetDateStr);
        
        // If no events exist on that day, just update the date
        if (targetDayEvents.length === 0) {
          return prev.map(evt => 
            evt.id === droppedEvent.id
              ? { ...evt, date: targetDateStr }
              : evt
          );
        }
        
        // Otherwise, insert at the beginning of the day (push others down)
        const withoutDragged = prev.filter(e => e.id !== droppedEvent.id);
        const firstTargetDayEventIndex = withoutDragged.findIndex(e => e.date === targetDateStr);
        
        if (firstTargetDayEventIndex === -1) {
          // Fallback: just append to the array with the new date
          return [...withoutDragged, { ...droppedEvent, date: targetDateStr }];
        }
        
        // Insert at the beginning of the day's events
        const result = [...withoutDragged];
        result.splice(firstTargetDayEventIndex, 0, { ...droppedEvent, date: targetDateStr });
        return result;
      });
    }
    
    // Reset drag state
    setCustomDragState({
      isDragging: false,
      event: null,
      position: null,
      startedOn: null,
      currentlyHovering: null,
      dropTargetId: null
    });
    
    // Reset other state
    console.log(`Drag operation completed`);
    
    // Clear the edge transition timer if it exists
    if (edgeTransitionTimerRef.current) {
      clearTimeout(edgeTransitionTimerRef.current);
      edgeTransitionTimerRef.current = null;
    }
    
    // Re-enable scrolling
    document.body.style.overflow = '';
    document.body.classList.remove('calendar-dragging');
  }, [customDragState, currentDate, allEvents]);
  
  // Function to trigger date change with global overlay tracking
  const triggerDateChange = useCallback((direction: 'left' | 'right') => {
    // Apply a cooldown to prevent rapid transitions
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < TRANSITION_COOLDOWN) {
      return;
    }
    
    // Mark we're transitioning and update the last transition time
    isTransitioningRef.current = true;
    lastTransitionTimeRef.current = now;
    
    // Visual indicator of transition in the overlay
    if (customDragState.isDragging && globalDragTracking.activeOverlay) {
      const cardElement = globalDragTracking.activeOverlay.querySelector('div');
      if (cardElement) {
        // Add a visual effect for transition
        cardElement.classList.add('pulse-outline');
        cardElement.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.25)';
      }
    }
    
    // Calculate new date
    const newDate = direction === 'left' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    
    // Update day offset counter
    dayOffsetRef.current += direction === 'left' ? -1 : 1;
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Update the event's date in drag state
    if (customDragState.isDragging && customDragState.event) {
      const updatedEvent = {
        ...customDragState.event,
        date: format(newDate, "yyyy-MM-dd")
      };
      
      setCustomDragState(prev => ({
        ...prev,
        event: updatedEvent,
        // Reset hover state for clean detection on the new day
        currentlyHovering: null,
        // Keep the position intact
        dropTargetId: null
      }));
    }
    
    // Create a subtle "page flip" effect
    const pageFlipEffect = document.createElement('div');
    pageFlipEffect.className = 
      `fixed inset-0 pointer-events-none z-[9000] ${direction === 'left' ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-blue-500/10 to-transparent`;
    document.body.appendChild(pageFlipEffect);
    
    // Remove the effect after the transition
    setTimeout(() => {
      pageFlipEffect.style.opacity = '0';
      pageFlipEffect.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(pageFlipEffect);
      }, 300);
    }, 100);
    
    // Log and change date
    console.log(`Transitioning to ${format(newDate, 'yyyy-MM-dd')}`);
    onDateChange(newDate);
    
    // After a brief delay, reset the transitioning state
    setTimeout(() => {
      isTransitioningRef.current = false;
      
      // Remove transition visual indicator
      if (globalDragTracking.activeOverlay) {
        const cardElement = globalDragTracking.activeOverlay.querySelector('div');
        if (cardElement) {
          cardElement.classList.remove('pulse-outline');
          cardElement.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
        }
      }
    }, 50); // Short delay to allow React to finish rendering
  }, [currentDate, onDateChange, customDragState.isDragging, customDragState.event]);
  
  // Set up global event listeners for drag operations
  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    // Touch and mouse handlers
    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Always prevent default for touch to avoid scrolling during drag
      if ('touches' in e) {
        e.preventDefault();
      }
      
      // Get the cursor/touch position
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Important: always update the global position tracking
      globalDragTracking.currentPosition = { x: clientX, y: clientY };
      
      // Update React state too (though it doesn't affect the overlay position)
      setCustomDragState(prev => ({
        ...prev,
        position: { x: clientX, y: clientY }
      }));
      
      // Edge detection for day transitions - only if not already transitioning
      if (!isTransitioningRef.current && effectiveView === 'day' && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
        const leftEdgeBoundary = containerRect.left + edgeWidth;
        const rightEdgeBoundary = containerRect.right - edgeWidth;
        
        // Determine which edge we're on, if any
        let currentEdge: 'left' | 'right' | null = null;
        
        if (clientX < leftEdgeBoundary) {
          currentEdge = 'left';
        } else if (clientX > rightEdgeBoundary) {
          currentEdge = 'right';
        }
        
        // Only update and trigger transition if edge changed
        if (currentEdge !== customDragState.currentlyHovering) {
          // Update the hover state
          setCustomDragState(prev => ({ 
            ...prev, 
            currentlyHovering: currentEdge 
          }));
          
          // Trigger transition if we're at an edge and it's a new edge
          if (currentEdge && Date.now() - lastTransitionTimeRef.current > TRANSITION_COOLDOWN) {
            triggerDateChange(currentEdge);
          }
        }
        
        // Drop target detection - only when not transitioning
        const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
        const eventCardUnderCursor = elementsAtPoint.find(el => {
          const card = el.closest('.event-card');
          return card && 
                 card.getAttribute('data-event-id') && 
                 card.getAttribute('data-event-id') !== customDragState.event?.id;
        });
        
        // Check for bottom drop zone too
        const bottomDropZone = elementsAtPoint.find(el => 
          el.getAttribute('data-drop-zone') === 'bottom'
        );
        
        let targetEventId = eventCardUnderCursor?.closest('.event-card')?.getAttribute('data-event-id') || null;
        
        // Special case: If we're over the bottom drop zone with no specific card targeted
        if (!targetEventId && bottomDropZone && filteredEvents.length > 0) {
          // Use the last event's ID as the insertion point (to add at the end)
          targetEventId = filteredEvents[filteredEvents.length - 1].id;
        }
        
        if (customDragState.dropTargetId !== targetEventId) {
          setCustomDragState(prev => ({
            ...prev,
            dropTargetId: targetEventId
          }));
        }
      }
    };
    
    // Mouse/touch end handler
    const handleEnd = () => {
      finalizeCustomDrag();
    };
    
    // Add event listeners with passive: false for touch to prevent scrolling
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);
    
    // Clean up
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [customDragState.isDragging, customDragState.event?.id, customDragState.currentlyHovering, customDragState.dropTargetId, effectiveView, finalizeCustomDrag, filteredEvents, triggerDateChange]);
  
  // Generate dynamic mock events based on the initial date
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
          imageUrl: getRandomElement(sampleImages),
          time: eventTimeStr,
          date: dateStr,
        });
      }
    });
    setAllEvents(generatedEvents);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Logging when currentDate changes
  useEffect(() => {
    console.log(`Current date updated to: ${format(currentDate, 'yyyy-MM-dd')}`);
    prevDateRef.current = currentDate;
    
    // Mark transition as complete
    isTransitioningRef.current = false;
    
    // If we're in the middle of a drag, reset the edge hovering state
    if (customDragState.isDragging) {
      setCustomDragState(prev => ({
        ...prev,
        currentlyHovering: null
      }));
    }
  }, [currentDate, customDragState.isDragging]);
  
  // Mobile swipe navigation (when not dragging)
  const handleSwipe = useCallback((
    event: MouseEvent | TouchEvent | PointerEvent, 
    info: PanInfo
  ) => {
    // Skip if in drag mode
    if (customDragState.isDragging) return;
    
    // Only handle horizontal swipes
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;

    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      onDateChange(subDays(currentDate, 1));
    } else if (info.offset.x < -swipeThreshold) {
      onDateChange(addDays(currentDate, 1));
    }
  }, [customDragState.isDragging, currentDate, onDateChange]);

  // Cancel drag operation
  const cancelCustomDrag = useCallback(() => {
    // Reset drag state
    setCustomDragState({
      isDragging: false,
      event: null,
      position: null,
      startedOn: null,
      currentlyHovering: null,
      dropTargetId: null
    });
    
    // Clear the edge transition timer if it exists
    if (edgeTransitionTimerRef.current) {
      clearTimeout(edgeTransitionTimerRef.current);
      edgeTransitionTimerRef.current = null;
    }
    
    // Reset other state
    document.body.style.overflow = '';
    document.body.classList.remove('calendar-dragging');
  }, []);

  // Place event handlers before render/JSX
  const handleEventClick = useCallback((event: KanbanEvent) => {
    if (customDragState.isDragging) return;
    setSelectedEvent(event);
  }, [customDragState.isDragging]);

  const handleEventMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => {
    // Only prevent default for mouse events, touchmove handler manages touch prevention
    if (!('touches' in e)) {
      e.preventDefault(); 
    }
    e.stopPropagation();
    
    // Get client coordinates
    const clientX = 'touches' in e 
      ? e.touches[0].clientX 
      : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e 
      ? e.touches[0].clientY 
      : (e as React.MouseEvent).clientY;
    
    console.log("Starting drag at", clientX, clientY);
    
    // Start the drag
    startCustomDrag(event, clientX, clientY);
  }, [startCustomDrag]);

  const handleEventClose = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleEventEdit = useCallback((event: KanbanEvent) => {
    console.log("Edit Event:", event);
    handleEventClose();
  }, [handleEventClose]);

  const handleEventDelete = useCallback((eventId: string) => {
    setAllEvents(prev => prev.filter((event) => event.id !== eventId));
    handleEventClose();
  }, [handleEventClose]);

  // --- Render Logic ---
  
  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-white rounded-b-astral shadow-sm border border-slate-100 border-t-0 flex-1 flex flex-col relative",
        isMobile && "min-h-[calc(100dvh-56px)] h-[calc(100dvh-56px)] overflow-y-auto",
        customDragState.isDragging && "touch-none" // Prevent all touch actions when dragging
      )}
    >
      {/* Status indicator for transitions - now handled by our overlay system */}
      {customDragState.isDragging && isTransitioningRef.current && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-500 h-1 animate-pulse"></div>
      )}
      
      {/* No longer need the React-based dragged overlay - we use our DOM element instead */}
      
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={effectiveView === 'week' ? `week-${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}` : `day-${format(currentDate, 'yyyy-MM-dd')}`}
          initial={{
            opacity: 0,
            x: effectiveView === 'week' ? (prevDateRef.current && prevDateRef.current > currentDate ? -100 : 100) : 0
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          exit={{
            opacity: 0,
            x: effectiveView === 'week' ? (prevDateRef.current && prevDateRef.current > currentDate ? 100 : -100) : 0
          }}
          transition={effectiveView === 'day' ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30, duration: 0.15 }}
          className="h-full flex-1"
          drag={!customDragState.isDragging && effectiveView === 'day' ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleSwipe}
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

      {/* Event detail dialog */}
      {selectedEvent && (
        <EventDetail 
          event={selectedEvent} 
          onClose={handleEventClose} 
          onEdit={handleEventEdit}
          onDelete={handleEventDelete}
        />
      )}
      
      {/* Escape key handler for cancelling drag */}
      {customDragState.isDragging && (
        <div
          tabIndex={0}
          className="fixed inset-0 z-[-1]"
          onKeyDown={(e) => e.key === 'Escape' && cancelCustomDrag()}
        />
      )}
      
      {/* Global CSS for animations */}
      <style jsx global>{`
        @keyframes pulse-outline {
          0% { outline-color: rgba(59, 130, 246, 0.5); }
          50% { outline-color: rgba(59, 130, 246, 0.9); }
          100% { outline-color: rgba(59, 130, 246, 0.5); }
        }
        
        .pulse-outline {
          animation: pulse-outline 0.8s infinite;
          outline-width: 3px !important;
        }
      `}</style>
    </div>
  );
};

export default CalendarContainer;