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
const EDGE_ZONE_WIDTH_PERCENTAGE = 0.30; // 30% for better mobile experience
const EDGE_HOVER_DELAY_MS = 60; // Make transition much faster - iOS-like
const TRANSITION_COOLDOWN_MS = 300; // Cooldown between transitions

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
  
  // Custom drag tracking state - expanded to include reordering info
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
  const transitioningRef = useRef(false);
  
  // Counter for traversed days
  const dayOffsetRef = useRef(0);

  // Update previous date after render cycle completes
  useEffect(() => {
    prevDateRef.current = currentDate;
  });

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

  // Function to clear the edge hover timer
  const clearEdgeTimer = useCallback(() => {
    if (edgeTimerRef.current) {
      clearTimeout(edgeTimerRef.current);
      edgeTimerRef.current = null;
    }
  }, []);

  // Function to handle pointer movement for edge detection
  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    // Skip if not in a drag operation or not in day view
    if (!customDragState.isDragging || !containerRef.current || effectiveView !== 'day') {
      return;
    }

    // Update position
    setCustomDragState(prev => ({
      ...prev,
      position: { x: clientX, y: clientY }
    }));

    // Edge detection
    const containerRect = containerRef.current.getBoundingClientRect();
    const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
    
    // Left edge detection
    if (clientX < containerRect.left + edgeWidth) {
      // Already in transition or already at left edge, don't trigger again
      if (customDragState.currentlyHovering === 'left' || transitioningRef.current) {
        return;
      }
      
      // Set to left edge hovering and trigger haptic feedback immediately
      setCustomDragState(prev => ({ ...prev, currentlyHovering: 'left' }));
      
      // Immediate haptic feedback when entering edge zone
      if (navigator.vibrate) {
        navigator.vibrate(25);
      }
      
      // Clear any existing timer
      clearEdgeTimer();
      
      // Start timer for day change - using a very short delay for iOS feel
      edgeTimerRef.current = setTimeout(() => {
        // Mark as transitioning to prevent multiple triggers
        transitioningRef.current = true;
        
        // Change day
        const newDate = subDays(currentDate, 1);
        dayOffsetRef.current -= 1;
        
        // Stronger haptic feedback for actual transition
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        
        // Update date
        onDateChange(newDate);
        
        // Allow some time for transition animation, then check if we need to transition again
        setTimeout(() => {
          transitioningRef.current = false;
          
          // Reset hovering state so we can detect edge entry again
          setCustomDragState(prev => ({ ...prev, currentlyHovering: null }));
          
          // If still dragging and still at the edge, trigger the process again
          if (customDragState.isDragging && containerRef.current) {
            const current = document.elementFromPoint(clientX, clientY);
            if (current && containerRef.current.contains(current)) {
              handlePointerMove(clientX, clientY);
            }
          }
        }, TRANSITION_COOLDOWN_MS);
      }, EDGE_HOVER_DELAY_MS);
    }
    // Right edge detection
    else if (clientX > containerRect.right - edgeWidth) {
      // Already in transition or already at right edge, don't trigger again
      if (customDragState.currentlyHovering === 'right' || transitioningRef.current) {
        return;
      }
      
      // Set to right edge hovering
      setCustomDragState(prev => ({ ...prev, currentlyHovering: 'right' }));
      
      // Immediate haptic feedback when entering edge zone
      if (navigator.vibrate) {
        navigator.vibrate(25);
      }
      
      // Clear any existing timer
      clearEdgeTimer();
      
      // Start timer for day change - using a very short delay for iOS feel
      edgeTimerRef.current = setTimeout(() => {
        // Mark as transitioning to prevent multiple triggers
        transitioningRef.current = true;
        
        // Change day
        const newDate = addDays(currentDate, 1);
        dayOffsetRef.current += 1;
        
        // Stronger haptic feedback for actual transition
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        
        // Update date
        onDateChange(newDate);
        
        // Allow some time for transition animation, then check if we need to transition again
        setTimeout(() => {
          transitioningRef.current = false;
          
          // Reset hovering state so we can detect edge entry again
          setCustomDragState(prev => ({ ...prev, currentlyHovering: null }));
          
          // If still dragging and still at the edge, trigger the process again
          if (customDragState.isDragging && containerRef.current) {
            const current = document.elementFromPoint(clientX, clientY);
            if (current && containerRef.current.contains(current)) {
              handlePointerMove(clientX, clientY);
            }
          }
        }, TRANSITION_COOLDOWN_MS);
      }, EDGE_HOVER_DELAY_MS);
    }
    // Not at any edge
    else if (customDragState.currentlyHovering !== null) {
      setCustomDragState(prev => ({ ...prev, currentlyHovering: null }));
      clearEdgeTimer();
    }
    
    // Find event under the cursor for reordering (within the same day)
    const elementsAtPoint = document.elementsFromPoint(clientX, clientY);
    const eventCardsUnderCursor = elementsAtPoint.filter(el => {
      // Find the closest .event-card parent or self
      const eventCard = el.closest('.event-card');
      if (!eventCard) return false;
      
      // Get the event ID from data attribute
      const eventId = eventCard.getAttribute('data-event-id');
      // Make sure it's not the currently dragged event
      return eventId && eventId !== customDragState.event?.id;
    });
    
    if (eventCardsUnderCursor.length > 0) {
      const targetCard = eventCardsUnderCursor[0].closest('.event-card');
      const targetEventId = targetCard?.getAttribute('data-event-id');
      
      if (targetEventId) {
        // We have a potential drop target for reordering
        setCustomDragState(prev => ({
          ...prev,
          dropTargetId: targetEventId
        }));
      }
    } else {
      // Clear drop target if not hovering over any event
      if (customDragState.dropTargetId) {
        setCustomDragState(prev => ({
          ...prev,
          dropTargetId: null
        }));
      }
    }
  }, [customDragState.isDragging, customDragState.currentlyHovering, customDragState.event?.id, customDragState.dropTargetId, clearEdgeTimer, currentDate, effectiveView, onDateChange]);

  // Set up event listeners for mouse/touch movement globally
  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    // Track whether we're in edge zone for continuous transition
    let inEdgeZone = false;
    let edgeCheckInterval: NodeJS.Timeout | null = null;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      // Only prevent default in touch events to allow scrolling with mouse
      if ('touches' in e) {
        e.preventDefault();
      }
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Check if we're in an edge zone
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const edgeWidth = rect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
        
        // Determine if we're in an edge zone
        inEdgeZone = (clientX < rect.left + edgeWidth) || (clientX > rect.right - edgeWidth);
      }
      
      handlePointerMove(clientX, clientY);
    };
    
    const startEdgeCheck = () => {
      // Set up an interval to consistently check for edge presence
      if (!edgeCheckInterval) {
        edgeCheckInterval = setInterval(() => {
          if (inEdgeZone && !transitioningRef.current && containerRef.current) {
            // Get current pointer position
            const pointerX = customDragState.position?.x;
            const pointerY = customDragState.position?.y;
            
            if (pointerX !== undefined && pointerY !== undefined) {
              // Force an edge check
              handlePointerMove(pointerX, pointerY);
            }
          }
        }, 100); // Check every 100ms
      }
    };
    
    const handleEnd = () => {
      // Handle the drop operation
      finalizeCustomDrag();
      
      // Clean up the interval
      if (edgeCheckInterval) {
        clearInterval(edgeCheckInterval);
        edgeCheckInterval = null;
      }
    };
    
    // Start the edge check mechanism
    startEdgeCheck();
    
    // Add global event listeners with the appropriate options for each event type
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
      
      // Clear any lingering timers
      if (edgeCheckInterval) {
        clearInterval(edgeCheckInterval);
      }
      clearEdgeTimer();
    };
  }, [customDragState.isDragging, handlePointerMove, clearEdgeTimer, customDragState.position]);
  
  // Start dragging an event
  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number) => {
    // Reset day offset counter
    dayOffsetRef.current = 0;
    
    // Set the drag state
    setCustomDragState({
      isDragging: true,
      event: event,
      position: { x: clientX, y: clientY },
      startedOn: event.date, // Remember original date
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
  
  // End the drag operation and process the final placement
  const finalizeCustomDrag = useCallback(() => {
    if (!customDragState.isDragging || !customDragState.event) {
      return;
    }
    
    // Clear any active edge timer
    clearEdgeTimer();
    
    // Restore scrolling
    document.body.style.overflow = '';
    
    // Remove dragging class
    document.body.classList.remove('calendar-dragging');
    
    // Calculate target date based on current date + any day offset
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
    transitioningRef.current = false;
  }, [customDragState, clearEdgeTimer, currentDate, allEvents]);
  
  // Handle cancel drag (e.g. escape key)
  const cancelCustomDrag = useCallback(() => {
    // Clear any active edge timer
    clearEdgeTimer();
    
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
    transitioningRef.current = false;
  }, [clearEdgeTimer]);
  
  // Handle event card mouse down to start drag
  const handleEventMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get client coordinates
    const clientX = 'touches' in e 
      ? e.touches[0].clientX 
      : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e 
      ? e.touches[0].clientY 
      : (e as React.MouseEvent).clientY;
    
    // Start the drag
    startCustomDrag(event, clientX, clientY);
    
    // For mobile: immediately check if we're already at an edge
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
      
      // Check if we're starting the drag near an edge
      if (clientX < containerRect.left + edgeWidth) {
        handlePointerMove(clientX, clientY); // Begin edge detection immediately
      } else if (clientX > containerRect.right - edgeWidth) {
        handlePointerMove(clientX, clientY); // Begin edge detection immediately
      }
    }
  }, [startCustomDrag, handlePointerMove]);
  
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
      pointerEvents: 'none' as const
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
            <div className="absolute top-0 left-0 h-full w-[30%] z-30 pointer-events-none">
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
            <div className="absolute top-0 right-0 h-full w-[30%] z-30 pointer-events-none">
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
        isMobile && "min-h-[calc(100dvh-56px)] h-[calc(100dvh-56px)] overflow-y-auto"
      )}
      onTouchMove={(e) => {
        // Add additional handling for edge detection during normal touch events
        if (customDragState.isDragging && e.touches.length === 1) {
          const touch = e.touches[0];
          handlePointerMove(touch.clientX, touch.clientY);
        }
      }}
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