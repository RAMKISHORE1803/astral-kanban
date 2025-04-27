"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addHours, addDays, subDays } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { KanbanEvent, createDateWithTime } from "@/app/lib/utils";
import EventCard from "./EventCard";
import EventDetail from "./EventDetail";
import sampleEventsContent from "@/app/lib/eventData";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import { cn } from "@/app/lib/utils";

// Helper to get sample content randomly
const sampleTitles = Object.values(sampleEventsContent).flat().map(e => e.title);
const sampleDescriptions = Object.values(sampleEventsContent).flat().map(e => e.description);
const sampleImages = Object.values(sampleEventsContent).flat().map(e => e.imageUrl);
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper component for rendering a day
interface CalendarDayProps {
  dateStr: string;
  day: Date;
  isToday: boolean;
  isHighlighted: boolean;
  events: KanbanEvent[];
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
  onEventClick: (event: KanbanEvent) => void;
}

const CalendarDay = ({ 
  dateStr, 
  day, 
  isToday, 
  isHighlighted,
  events, 
  onEventMouseDown, 
  onEventClick 
}: CalendarDayProps) => {
  return (
    <div className={cn(
      "flex flex-col bg-white border-r border-b border-slate-200 transition-colors",
      isHighlighted && "bg-blue-50/30"
    )}>
      <div className={cn(
        "p-2 pt-1 border-b border-slate-200 text-center text-xs font-medium sticky top-0 z-[1]",
        "bg-white",
        isToday ? "text-astral-blue" : "text-slate-600"
      )}>
        <span className="uppercase text-[10px]">{format(day, "EEE")}</span>
        <span className={cn(
          "block text-xl mt-0.5 rounded-full mx-auto flex items-center justify-center h-7 w-7",
          isToday && "bg-astral-blue text-white"
        )}>
          {format(day, "d")}
        </span>
      </div>
      <div className="p-1 overflow-y-auto space-y-0 bg-white max-h-[85vh]">
        {events.map(event => (
          <div 
            key={event.id} 
            onMouseDown={(e) => onEventMouseDown(event, e)}
            onTouchStart={(e) => onEventMouseDown(event, e)}
            className="cursor-grab active:cursor-grabbing event-card"
            data-event-id={event.id}
          >
            <EventCard 
              event={event} 
              onClick={() => onEventClick(event)} 
            />
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-center text-xs text-slate-400 h-full min-h-[100px] flex items-center justify-center">
            <span className="text-slate-300">&middot;</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Constants for edge detection
const EDGE_ZONE_WIDTH_PERCENTAGE = 0.25; // 25% is good for edge detection

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
  
  // Timer references
  const edgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Counter for traversed days
  const dayOffsetRef = useRef(0);
  
  // Debug flag to track transitions
  const debugRef = useRef({
    transitionsAttempted: 0,
    transitionsCompleted: 0
  });

  // Logging when currentDate changes
  useEffect(() => {
    console.log(`Current date updated to: ${format(currentDate, 'yyyy-MM-dd')}`);
    
    // Update previous date reference
    prevDateRef.current = currentDate;
    
    // If we were transitioning during a drag, mark the transition as complete
    if (customDragState.isDragging && edgeTimerRef.current) {
      console.log("✅ Transition complete during drag. Resetting edgeTimerRef.");
      edgeTimerRef.current = null; // Reset flag here
      debugRef.current.transitionsCompleted++; // Increment completion count

      // Optional: Re-check edge immediately if still dragging to allow continuous scrolling
      // setTimeout(() => {
      //   if (customDragState.isDragging && customDragState.position) {
      //     handlePointerMove(customDragState.position.x, customDragState.position.y);
      //   }
      // }, 50);
    }
    
  }, [currentDate, customDragState.isDragging]); // Ensure isDragging is a dependency

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

  // Function to trigger date change with edge direction
  const triggerDateChange = useCallback((direction: 'left' | 'right') => {
    debugRef.current.transitionsAttempted++;
    
    // Calculate new date
    const newDate = direction === 'left' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    
    // Update day offset counter
    dayOffsetRef.current += direction === 'left' ? -1 : 1;
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Log the change
    console.log(`⚠️ DATE CHANGE ATTEMPT: ${format(currentDate, 'yyyy-MM-dd')} -> ${format(newDate, 'yyyy-MM-dd')}`);
    
    // Actually update the date
    onDateChange(newDate);
    
    // Log successful transition
    console.log("✅ Transition complete");
  }, [currentDate, onDateChange]);

  // Function to handle pointer movement for edge detection - REFINED LOGIC
  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    // Skip if not in a drag operation or not in day view
    if (!customDragState.isDragging || !containerRef.current || effectiveView !== 'day') {
      return;
    }

    // Update position - this is critical for the overlay to follow the cursor
    setCustomDragState(prev => ({
      ...prev,
      position: { x: clientX, y: clientY }
    }));

    console.log(`[PointerMove] Pos: ${clientX.toFixed(1)}, ${clientY.toFixed(1)}`); // Log position

    // Edge detection
    const containerRect = containerRef.current.getBoundingClientRect();
    const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
    const leftEdgeBoundary = containerRect.left + edgeWidth;
    const rightEdgeBoundary = containerRect.right - edgeWidth;

    console.log(`[PointerMove] Bounds: L=${leftEdgeBoundary.toFixed(1)}, R=${rightEdgeBoundary.toFixed(1)}, EdgeWidth=${edgeWidth.toFixed(1)}`); // Log boundaries

    // Left edge detection - IMMEDIATE DATE CHANGE
    if (clientX < leftEdgeBoundary) {
      console.log("[PointerMove] Left Edge Detected - Triggering Date Change");
      // Update hover state
      if (customDragState.currentlyHovering !== 'left') {
        setCustomDragState(prev => ({ ...prev, currentlyHovering: 'left' }));
        triggerDateChange('left'); // Trigger immediately
      }
    }
    // Right edge detection - IMMEDIATE DATE CHANGE
    else if (clientX > rightEdgeBoundary) {
      console.log("[PointerMove] Right Edge Detected - Triggering Date Change");
      // Update hover state
      if (customDragState.currentlyHovering !== 'right') {
        setCustomDragState(prev => ({ ...prev, currentlyHovering: 'right' }));
        triggerDateChange('right'); // Trigger immediately
      }
    }
    // Not at any edge
    else if (customDragState.currentlyHovering !== null) {
      console.log("[PointerMove] Exited Edge Zone");
      setCustomDragState(prev => ({ ...prev, currentlyHovering: null }));
    }
    
    // Find event under the cursor for reordering (unchanged)
    const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
    const eventCardsUnderCursor = elementsAtPoint.filter(el => {
      const eventCard = el.closest('.event-card');
      if (!eventCard) return false;
      
      const eventId = eventCard.getAttribute('data-event-id');
      return eventId && eventId !== customDragState.event?.id;
    });
    
    if (eventCardsUnderCursor.length > 0) {
      const targetCard = eventCardsUnderCursor[0].closest('.event-card');
      const targetEventId = targetCard?.getAttribute('data-event-id');
      
      if (targetEventId) {
        setCustomDragState(prev => ({
          ...prev,
          dropTargetId: targetEventId
        }));
      }
    } else {
      if (customDragState.dropTargetId) {
        setCustomDragState(prev => ({
          ...prev,
          dropTargetId: null
        }));
      }
    }
  }, [customDragState.isDragging, customDragState.event?.id, customDragState.dropTargetId, customDragState.currentlyHovering, effectiveView, triggerDateChange]);
  
  // End the drag operation and process the final placement
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
          // Reorder events
          setAllEvents(prevEvents => {
            const oldIndex = prevEvents.findIndex(e => e.id === droppedEvent.id);
            const newIndex = prevEvents.findIndex(e => e.id === targetEvent.id);
            
            if (oldIndex === -1 || newIndex === -1) return prevEvents;
            
            // Create a new array with the item moved to the new position
            const newArray = [...prevEvents];
            const [movedItem] = newArray.splice(oldIndex, 1);
            newArray.splice(newIndex, 0, movedItem);
            
            return newArray;
          });
          console.log(`Reordered ${droppedEvent.id} within day ${droppedEvent.date}`);
        }
        // Moving to different day at specific position
        else {
          setAllEvents(prevEvents => {
            // Create a copy without the dragged event
            const withoutDragged = prevEvents.filter(e => e.id !== droppedEvent.id);
            
            // Find the index where we want to insert
            const targetIndex = withoutDragged.findIndex(e => e.id === targetEvent.id);
            
            // Update the dragged event with new date
            const updatedEvent = { ...droppedEvent, date: targetEvent.date };
            
            // Insert at proper position
            if (targetIndex !== -1) {
              const result = [...withoutDragged];
              result.splice(targetIndex, 0, updatedEvent);
              return result;
            } else {
              return [...withoutDragged, updatedEvent];
            }
          });
          console.log(`Moved ${droppedEvent.id} from ${droppedEvent.date} to ${targetEvent.date} at position near ${targetEvent.id}`);
        }
      }
    }
    // Simple date change without specific reordering
    else if (customDragState.startedOn !== targetDateStr) {
      // Update the event's date
      setAllEvents(prev => prev.map(evt => 
        evt.id === droppedEvent.id
          ? { ...evt, date: targetDateStr }
          : evt
      ));
      
      console.log(`Moved ${droppedEvent.id} from ${customDragState.startedOn} to ${targetDateStr}`);
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
    edgeTimerRef.current = null;
    console.log(`Drag operation completed with ${debugRef.current.transitionsCompleted}/${debugRef.current.transitionsAttempted} transitions`);
  }, [customDragState, currentDate, allEvents]);
  
  // Handle cancel drag (e.g. escape key)
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
    
    // Reset other state
    edgeTimerRef.current = null;
  }, []);
  
  // Set up event listeners for mouse/touch movement globally
  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Prevent default for touch events to avoid scrolling
      if ('touches' in e) {
        e.preventDefault();
      }
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      handlePointerMove(clientX, clientY);
    };
    
    const handleEnd = () => {
      finalizeCustomDrag();
    };
    
    // Add global event listeners with passive: false for touch events
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    
    return () => {
      // Clean up listeners
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [customDragState.isDragging, handlePointerMove, finalizeCustomDrag]);
  
  // Start dragging an event
  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number) => {
    // Reset day offset counter
    dayOffsetRef.current = 0;
    
    // Reset debug counters
    debugRef.current = {
      transitionsAttempted: 0,
      transitionsCompleted: 0
    };
    
    // Reset transition state
    edgeTimerRef.current = null;
    
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
    
    // Add class to body to indicate drag operation is active
    document.body.classList.add('calendar-dragging');
    
    // Prevent normal click handling
    setSelectedEvent(null);
    
    // For mobile: immediately check if we're already at an edge
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
      
      // Check if we're starting the drag near an edge
      if (clientX < containerRect.left + edgeWidth || clientX > containerRect.right - edgeWidth) {
        handlePointerMove(clientX, clientY); // Begin edge detection immediately
      }
    }
  }, [handlePointerMove]);

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

  // --- Render Logic ---
  
  // Get cursor styles for the dragged event overlay
  const getDraggedEventStyle = useMemo(() => {
    if (!customDragState.position) return {};
    
    // Position slightly offset from the cursor
    return {
      position: 'fixed' as const,
      left: `${customDragState.position.x - 100}px`,
      top: `${customDragState.position.y - 30}px`,
      zIndex: 9999,
      transform: 'scale(0.95)',
      opacity: 0.9,
      pointerEvents: 'none' as const,
      touchAction: 'none' as const // Prevent touch actions on the overlay
    };
  }, [customDragState.position]);

  // Render day view content
  const renderDayViewContent = useCallback(() => {
    const dayEvents = allEvents.filter(event => event.date === format(currentDate, "yyyy-MM-dd"));
    const currentDateStr = format(currentDate, "yyyy-MM-dd");
    
    // Are we peeking at an edge?
    const isPeeking = Boolean(customDragState.isDragging && customDragState.currentlyHovering);
    
    return (
      <div className="relative h-full">
        {/* Edge indicators - only shown when dragging */}
        {customDragState.isDragging && (
          <>
            {/* Left edge zone with arrow */}
            <div className="absolute top-0 left-0 h-full w-[25%] z-30 pointer-events-none">
              <div className={`h-full ${
                customDragState.currentlyHovering === 'left' 
                  ? 'bg-gradient-to-r from-blue-300/30 to-transparent border-r-4 border-blue-400/70 border-dashed' 
                  : 'bg-gradient-to-r from-blue-200/10 to-transparent'
              }`} />
              
              {/* Left arrow indicator */}
              <motion.div
                className="absolute top-1/2 left-6 transform -translate-y-1/2 z-40"
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: customDragState.currentlyHovering === 'left' ? 1 : 0.3,
                  x: customDragState.currentlyHovering === 'left' ? 0 : -10,
                  scale: customDragState.currentlyHovering === 'left' ? 1.2 : 0.9
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className={`${
                  customDragState.currentlyHovering === 'left' 
                    ? 'bg-blue-500 shadow-lg shadow-blue-400/30' 
                    : 'bg-blue-400'
                } rounded-full h-12 w-12 flex items-center justify-center transition-all duration-200`}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 19L8 12L15 5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </motion.div>
            </div>
            
            {/* Right edge zone with arrow */}
            <div className="absolute top-0 right-0 h-full w-[25%] z-30 pointer-events-none">
              <div className={`h-full ${
                customDragState.currentlyHovering === 'right' 
                  ? 'bg-gradient-to-l from-blue-300/30 to-transparent border-l-4 border-blue-400/70 border-dashed' 
                  : 'bg-gradient-to-l from-blue-200/10 to-transparent'
              }`} />
              
              {/* Right arrow indicator */}
              <motion.div
                className="absolute top-1/2 right-6 transform -translate-y-1/2 z-40"
                initial={{ opacity: 0, x: 10 }}
                animate={{ 
                  opacity: customDragState.currentlyHovering === 'right' ? 1 : 0.3,
                  x: customDragState.currentlyHovering === 'right' ? 0 : 10,
                  scale: customDragState.currentlyHovering === 'right' ? 1.2 : 0.9
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className={`${
                  customDragState.currentlyHovering === 'right' 
                    ? 'bg-blue-500 shadow-lg shadow-blue-400/30' 
                    : 'bg-blue-400'
                } rounded-full h-12 w-12 flex items-center justify-center transition-all duration-200`}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 5L16 12L9 19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </motion.div>
            </div>
          </>
        )}
        
        {/* Day displacement indicator */}
        {customDragState.isDragging && dayOffsetRef.current !== 0 && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-1.5 rounded-full shadow-lg font-medium text-sm">
            {dayOffsetRef.current > 0 ? `+${dayOffsetRef.current}` : dayOffsetRef.current} days
          </div>
        )}
        
        {/* Debug transition counter */}
        {customDragState.isDragging && (
          <div className="absolute top-[60px] left-1/2 transform -translate-x-1/2 z-50 bg-black text-white px-3 py-1 rounded text-xs whitespace-nowrap">
            <span className="font-bold">Transitions:</span> {debugRef.current.transitionsCompleted}/{debugRef.current.transitionsAttempted} | 
            <span className="font-bold ml-1">Edge:</span> {customDragState.currentlyHovering || 'none'} | 
            <span className="font-bold ml-1">Date:</span> {format(currentDate, "MM-dd")}
          </div>
        )}
      
        {/* Main content container with peek effect */}
        <motion.div
          className="p-4 space-y-0 overflow-y-auto h-full relative"
          animate={isPeeking ? {
            x: customDragState.currentlyHovering === 'left' ? 25 : customDragState.currentlyHovering === 'right' ? -25 : 0,
            scale: isPeeking ? 0.98 : 1,
            opacity: isPeeking ? 0.9 : 1
          } : { x: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          {dayEvents.length === 0 ? (
            <p className="text-center text-slate-500 pt-10">No events scheduled.</p>
          ) : (
            dayEvents.map(event => (
              <div 
                key={event.id} 
                onMouseDown={(e) => handleEventMouseDown(event, e)}
                onTouchStart={(e) => handleEventMouseDown(event, e)}
                className={cn(
                  "cursor-grab active:cursor-grabbing event-card",
                  customDragState.dropTargetId === event.id && "border-2 border-blue-500 rounded-lg"
                )}
                data-event-id={event.id}
              >
                <EventCard 
                  event={event} 
                  onClick={() => handleEventClick(event)} 
                />
              </div>
            ))
          )}
        </motion.div>
      </div>
    );
  }, [allEvents, currentDate, customDragState.currentlyHovering, customDragState.isDragging, customDragState.dropTargetId, handleEventClick, handleEventMouseDown]);

  // Render week view content
  const renderWeekViewContent = useCallback(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

    return (
      <div className="grid grid-cols-7 h-[90vh] border-t border-l border-slate-200">
        {weekDays.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDateForWeek[dateStr] || [];
          const isToday = isSameDay(day, new Date());
          const isHighlighted = customDragState.isDragging;

          return (
            <CalendarDay
              key={dateStr}
              dateStr={dateStr}
              day={day}
              isToday={isToday}
              isHighlighted={isHighlighted}
              events={dayEvents}
              onEventMouseDown={handleEventMouseDown}
              onEventClick={handleEventClick}
            />
          );
        })}
      </div>
    );
  }, [currentDate, customDragState.isDragging, eventsByDateForWeek, handleEventClick, handleEventMouseDown]);

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
        <div style={getDraggedEventStyle}>
          <EventCard event={customDragState.event} onClick={() => {}} />
        </div>
      )}
      
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={effectiveView === 'week' ? `week-${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}` : `day-${format(currentDate, 'yyyy-MM-dd')}`}
          initial={{ 
            opacity: 0,
            x: prevDateRef.current && new Date(prevDateRef.current) > new Date(currentDate) ? -100 : 100
          }}
          animate={{ 
            opacity: 1,
            x: 0 
          }}
          exit={{ 
            opacity: 0,
            x: prevDateRef.current && new Date(prevDateRef.current) > new Date(currentDate) ? 100 : -100
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.15 }}
          className="h-full"
          drag={!customDragState.isDragging && effectiveView === 'day' ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleSwipe}
        >
          {effectiveView === 'week' ? renderWeekViewContent() : renderDayViewContent()}
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