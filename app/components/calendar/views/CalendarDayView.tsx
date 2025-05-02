"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import EventCard from "../EventCard";
import { cn } from "@/app/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KanbanEvent, CalendarDayViewProps, CustomDragState, DebugInfo } from "@/app/types/calendar";

// Constants
const SCROLL_THRESHOLD = 10; // pixels of vertical movement to detect scroll intent
const LONG_PRESS_DURATION = 400; // ms for mobile long press to initiate drag

const CalendarDayView = ({
  currentDate,
  dayEvents,
  customDragState,
  dayOffset,
  debugInfo,
  onEventClick,
  onEventMouseDown,
  containerRef
}: CalendarDayViewProps) => {
  // State for touch handling
  const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number} | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  
  // State for long press detection
  const [pressedEvent, setPressedEvent] = useState<KanbanEvent | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to store the current date to detect changes
  const prevDateRef = useRef(currentDate);

  // Reference to content area for scrolling
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Effect to handle date changes
  useEffect(() => {
    // Only run this effect if the date actually changed (not on initial mount)
    if (prevDateRef.current && prevDateRef.current !== currentDate) {
      // If we're in the middle of a drag operation during date change,
      // we want to ensure events are rendered immediately with no opacity transitions
      if (customDragState.isDragging) {
        // We could add special handling here if needed
        console.log("Date changed during drag");
      }
    }
    
    // Update ref with current date
    prevDateRef.current = currentDate;
  }, [currentDate, customDragState.isDragging]);
  
  // Clear any active press timers
  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // Handle initial touch down
  const handleTouchStart = useCallback((event: KanbanEvent, e: React.TouchEvent) => {
    if (customDragState.isDragging) return;
    
    e.stopPropagation();
    clearPressTimer();
    setPressedEvent(event);
    
    // Record starting touch position
    setTouchStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
    setIsScrolling(false);
    
    // Start long press timer for drag initiation
    pressTimerRef.current = setTimeout(() => {
      onEventMouseDown(event, e);
      setPressedEvent(null);
      setTouchStartPos(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, customDragState.isDragging, onEventMouseDown]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos || customDragState.isDragging) return;
    
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.y);
    const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.x);
    
    // If vertical movement exceeds threshold, consider it scrolling
    if (deltaY > SCROLL_THRESHOLD && deltaY > deltaX) {
      setIsScrolling(true);
      clearPressTimer();
    }
  }, [touchStartPos, customDragState.isDragging, clearPressTimer]);

  // Handle touch end - if no scrolling was detected, treat as a click
  const handleTouchEnd = useCallback((event: KanbanEvent) => {
    if (pressedEvent?.id === event.id && !isScrolling && !customDragState.isDragging) {
      clearPressTimer();
      onEventClick(event);
    }
    
    setPressedEvent(null);
    setTouchStartPos(null);
    setIsScrolling(false);
  }, [clearPressTimer, onEventClick, pressedEvent, isScrolling, customDragState.isDragging]);

  // Handle touch cancel - clear any pending actions
  const handleTouchCancel = useCallback(() => {
    clearPressTimer();
    setPressedEvent(null);
    setTouchStartPos(null);
    setIsScrolling(false);
  }, [clearPressTimer]);
  
  // Mouse events - simpler since scrolling is usually handled by wheel events
  const handleMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent) => {
    if (customDragState.isDragging) return;
    
    e.stopPropagation();
    clearPressTimer();
    setPressedEvent(event);
    
    // Start long press timer for drag initiation
    pressTimerRef.current = setTimeout(() => {
      onEventMouseDown(event, e);
      setPressedEvent(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, customDragState.isDragging, onEventMouseDown]);

  // Mouse click - handle click event
  const handleClick = useCallback((event: KanbanEvent, e: React.MouseEvent) => {
    if (customDragState.isDragging) return;
    
    e.stopPropagation();
    clearPressTimer();
    onEventClick(event);
    setPressedEvent(null);
  }, [clearPressTimer, customDragState.isDragging, onEventClick]);
  
  // Simple function to check if we're hovering near an edge
  const isEdgeHovering = customDragState.isDragging && customDragState.currentlyHovering !== null;
  
  const formattedDate = format(currentDate, "yyyy-MM-dd");
  
  return (
    <div className="relative h-full overflow-hidden flex flex-col" ref={containerRef}>
      {/* Simplified Edge indicators - arrows only, no text labels */}
      <AnimatePresence>
        {customDragState.isDragging && (
          <>
            {/* Left edge indicator - Previous Day (arrow only) */}
            <motion.div 
              className={cn(
                "absolute left-0 top-0 bottom-0 z-30 pointer-events-none flex items-center",
                "bg-gradient-to-r from-blue-500/20 to-transparent"
              )}
              initial={{ width: "0%", opacity: 0 }}
              animate={{ 
                width: customDragState.currentlyHovering === 'left' ? "15%" : "5%",
                opacity: customDragState.currentlyHovering === 'left' ? 1 : 0.5
              }}
              exit={{ width: "0%", opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Navigation arrow with animation */}
              <motion.div 
                className={cn(
                  "absolute left-3 p-3 rounded-full bg-blue-500 shadow-lg",
                  customDragState.currentlyHovering === 'left' ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  scale: customDragState.currentlyHovering === 'left' ? [1, 1.1, 1] : 1,
                  x: customDragState.currentlyHovering === 'left' ? [-5, 0, -5] : 0
                }}
                transition={{ 
                  repeat: customDragState.currentlyHovering === 'left' ? Infinity : 0,
                  duration: 1.5
                }}
              >
                <ChevronLeft className="text-white" size={20} />
              </motion.div>
            </motion.div>
            
            {/* Right edge indicator - Next Day (arrow only) */}
            <motion.div 
              className={cn(
                "absolute right-0 top-0 bottom-0 z-30 pointer-events-none flex items-center justify-end",
                "bg-gradient-to-l from-blue-500/20 to-transparent"
              )}
              initial={{ width: "0%", opacity: 0 }}
              animate={{ 
                width: customDragState.currentlyHovering === 'right' ? "15%" : "5%", 
                opacity: customDragState.currentlyHovering === 'right' ? 1 : 0.5
              }}
              exit={{ width: "0%", opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Navigation arrow with animation */}
              <motion.div 
                className={cn(
                  "absolute right-3 p-3 rounded-full bg-blue-500 shadow-lg",
                  customDragState.currentlyHovering === 'right' ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  scale: customDragState.currentlyHovering === 'right' ? [1, 1.1, 1] : 1,
                  x: customDragState.currentlyHovering === 'right' ? [5, 0, 5] : 0
                }}
                transition={{ 
                  repeat: customDragState.currentlyHovering === 'right' ? Infinity : 0, 
                  duration: 1.5
                }}
              >
                <ChevronRight className="text-white" size={20} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Day displacement indicator - Shows how many days moved */}
      {/* <AnimatePresence>
        {customDragState.isDragging && dayOffset !== 0 && (
          <motion.div 
            className="absolute top-4 left-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg"
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
          >
            <span className="font-medium">{dayOffset > 0 ? `+${dayOffset}` : dayOffset} days</span>
          </motion.div>
        )}
      </AnimatePresence> */}

      {/* Day header - fixed at top */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h3 className="text-lg font-medium text-gray-900">
          {format(currentDate, "EEEE, MMMM d, yyyy")}
        </h3>
      </div>

      {/* Main content container - scrollable */}
      <div 
        ref={contentRef}
        className={cn(
          "px-4 py-4 overflow-y-auto flex-1 calendar-day-view-content",
          isEdgeHovering && "opacity-90 transition-opacity duration-200" // Fade content during edge hovering
        )}
        style={{
          overscrollBehavior: 'contain', // Prevent pull-to-refresh on iOS
          touchAction: customDragState.isDragging ? 'none' : 'pan-y', // Allow vertical scrolling only when not dragging
        }}
      >
        {dayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            No events for this day
          </div>
        ) : (
          <div className="space-y-3 relative pb-10">
            {dayEvents.map((event) => (
              <div
                key={event.id}
                className="relative"
                data-event-id={event.id}
              >
                <EventCard
                  event={event}
                  isSource={customDragState.event?.id === event.id}
                  isDraggable={!customDragState.isDragging || customDragState.event?.id === event.id}
                  isDropTarget={false}
                  onClick={(e) => handleClick(event, e as unknown as React.MouseEvent)}
                  onMouseDown={(e) => handleMouseDown(event, e as React.MouseEvent)}
                  onTouchStart={(e) => handleTouchStart(event, e as React.TouchEvent)}
                  onTouchEnd={() => handleTouchEnd(event)}
                />
              </div>
            ))}
            {/* Extra padding at the bottom for comfortable scrolling */}
            <div className="h-10"></div>
          </div>
        )}
      </div>
      
      {/* Scroll indicator tip - appears briefly when user first views the list */}
      {dayEvents.length > 3 && (
        <div className="scroll-indicator">
          <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none bg-gradient-to-t from-white to-transparent opacity-70" />
        </div>
      )}
    </div>
  );
};

export default CalendarDayView;