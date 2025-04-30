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

  const effectiveView = isMobile ? "day" : view;

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

  // Function to trigger date change
  const triggerDateChange = useCallback((direction: 'left' | 'right') => {
    // Apply a cooldown to prevent rapid transitions
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < TRANSITION_COOLDOWN) {
      return;
    }
    
    // Mark we're transitioning and update the last transition time
    isTransitioningRef.current = true;
    lastTransitionTimeRef.current = now;
    
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
        event: updatedEvent
      }));
    }
    
    // Log and change date
    console.log(`Transitioning to ${format(newDate, 'yyyy-MM-dd')}`);
    onDateChange(newDate);
  }, [currentDate, onDateChange, customDragState.isDragging, customDragState.event]);

  // Finalize drag operation
  const finalizeCustomDrag = useCallback(() => {
    if (!customDragState.isDragging || !customDragState.event) {
      return;
    }
    
    // Calculate target date based on current date
    const targetDateStr = format(currentDate, "yyyy-MM-dd");
    const droppedEvent = customDragState.event;
    const dropTargetId = customDragState.dropTargetId;
    
    // Handle reordering within the same day
    if (dropTargetId) {
      const targetEvent = allEvents.find(e => e.id === dropTargetId);
      if (targetEvent) {
        // Same day reordering
        if (targetEvent.date === droppedEvent.date) {
          setAllEvents(prevEvents => {
            const oldIndex = prevEvents.findIndex(e => e.id === droppedEvent.id);
            const newIndex = prevEvents.findIndex(e => e.id === targetEvent.id);
            
            if (oldIndex === -1 || newIndex === -1) return prevEvents;
            
            const newArray = [...prevEvents];
            const [movedItem] = newArray.splice(oldIndex, 1);
            newArray.splice(newIndex, 0, movedItem);
            
            return newArray;
          });
        }
        // Moving to different day at specific position
        else {
          setAllEvents(prevEvents => {
            const withoutDragged = prevEvents.filter(e => e.id !== droppedEvent.id);
            const targetIndex = withoutDragged.findIndex(e => e.id === targetEvent.id);
            const updatedEvent = { ...droppedEvent, date: targetEvent.date };
            
            if (targetIndex !== -1) {
              const result = [...withoutDragged];
              result.splice(targetIndex, 0, updatedEvent);
              return result;
            } else {
              return [...withoutDragged, updatedEvent];
            }
          });
        }
      }
    }
    // Simple date change without specific reordering
    else if (customDragState.startedOn !== targetDateStr) {
      setAllEvents(prev => prev.map(evt => 
        evt.id === droppedEvent.id
          ? { ...evt, date: targetDateStr }
          : evt
      ));
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
    console.log(`Drag operation completed with ${debugRef.current.transitionsCompleted}/${debugRef.current.transitionsAttempted} transitions`);
    
    // Clear the edge transition timer if it exists
    if (edgeTransitionTimerRef.current) {
      clearTimeout(edgeTransitionTimerRef.current);
      edgeTransitionTimerRef.current = null;
    }
    
    // Reset other state
    document.body.style.overflow = '';
    document.body.classList.remove('calendar-dragging');
  }, [customDragState, currentDate, allEvents]);

  // Global pointer tracking function - SEPARATE FROM EDGE DETECTION
  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    if (!customDragState.isDragging) return;
    
    // Always update the overlay position, even during transitions
    setCustomDragState(prev => ({
      ...prev,
      position: { x: clientX, y: clientY }
    }));
    
    // Skip edge detection if we're in a transition
    if (isTransitioningRef.current) return;
    
    // Only check edges in day view with a valid container reference
    if (effectiveView === 'day' && containerRef.current) {
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
        
        // Trigger transition if we're at an edge
        if (currentEdge) {
          triggerDateChange(currentEdge);
        }
      }
      
      // Find drop target for hover effect
      if (!isTransitioningRef.current) {
        const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
        const eventCardUnderCursor = elementsAtPoint.find(el => {
          const card = el.closest('.event-card');
          return card && 
                 card.getAttribute('data-event-id') && 
                 card.getAttribute('data-event-id') !== customDragState.event?.id;
        });
        
        const targetEventId = eventCardUnderCursor?.closest('.event-card')?.getAttribute('data-event-id') || null;
        
        if (customDragState.dropTargetId !== targetEventId) {
          setCustomDragState(prev => ({
            ...prev,
            dropTargetId: targetEventId
          }));
        }
      }
    }
  }, [
    customDragState.isDragging,
    customDragState.event?.id,
    customDragState.currentlyHovering,
    customDragState.dropTargetId,
    effectiveView,
    triggerDateChange
  ]);

  // Set up the global event listeners
  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    // Mouse/touch move handler
    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Always prevent default for touch to avoid scrolling during drag
      if ('touches' in e) {
        e.preventDefault();
      }
      
      // Get the cursor/touch position
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Update the position and check for edges
      updateDragPosition(clientX, clientY);
    };
    
    // Mouse/touch end handler
    const handleEnd = () => {
      finalizeCustomDrag();
    };
    
    // Set up event listeners
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
  }, [customDragState.isDragging, finalizeCustomDrag, updateDragPosition]);

  // Start dragging an event
  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number) => {
    // Reset day offset counter
    dayOffsetRef.current = 0;
    
    // Reset transition state
    isTransitioningRef.current = false;
    
    // Set the drag state
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

  // Handle event card mouse down to start drag
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
  
  // Handle normal event click (when not dragging)
  const handleEventClick = useCallback((event: KanbanEvent) => {
    if (customDragState.isDragging) return;
    setSelectedEvent(event);
  }, [customDragState.isDragging]);

  // Handle event close from detail view
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

  // --- Render Logic ---
  
  // Get cursor styles for the dragged event overlay
  const getDraggedEventStyle = useMemo(() => {
    if (!customDragState.position) return {};
    
    // Basic positioning
    return {
      position: 'fixed' as const,
      left: `${customDragState.position.x - 100}px`,
      top: `${customDragState.position.y - 30}px`,
      zIndex: 9999,
      transform: 'scale(0.95)',
      opacity: 0.9,
      pointerEvents: 'none' as const,
      touchAction: 'none' as const,
      willChange: 'transform', // Performance hint for the browser
      transition: 'none' // No transitions during drag for immediate response
    };
  }, [customDragState.position]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-white rounded-b-astral shadow-sm border border-slate-100 border-t-0 flex-1 flex flex-col relative",
        isMobile && "min-h-[calc(100dvh-56px)] h-[calc(100dvh-56px)] overflow-y-auto",
        customDragState.isDragging && "touch-none" // Prevent all touch actions when dragging
      )}
    >
      {/* Dragged event overlay - follows cursor/finger */}
      {customDragState.isDragging && customDragState.event && (
        <div 
          style={getDraggedEventStyle}
          className="z-50 pointer-events-none" // Ensure it's always on top
        >
          <EventCard event={customDragState.event} onClick={() => {}} />
        </div>
      )}
      
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
    </div>
  );
};

export default CalendarContainer;