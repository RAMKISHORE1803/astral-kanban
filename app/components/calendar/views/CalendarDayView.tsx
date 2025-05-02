"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import EventCard from "../EventCard";
import { cn } from "@/app/lib/utils";
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

  // Handle initial touch/mouse down - start timer for long press
  const handlePointerDown = useCallback((event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    clearPressTimer();
    setPressedEvent(event);
    
    // Start long press timer
    pressTimerRef.current = setTimeout(() => {
      onEventMouseDown(event, e);
      setPressedEvent(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, onEventMouseDown]);

  // Handle touch/mouse up - if no long press was triggered, treat as a click
  const handlePointerUp = useCallback((event: KanbanEvent) => {
    if (pressedEvent?.id === event.id) {
      clearPressTimer();
      onEventClick(event);
      setPressedEvent(null);
    }
  }, [clearPressTimer, onEventClick, pressedEvent]);

  // Handle touch/mouse leave - cancel long press
  const handlePointerLeave = useCallback(() => {
    clearPressTimer();
    setPressedEvent(null);
  }, [clearPressTimer]);
  
  // Simple function to check if we're hovering near an edge
  const isEdgeHovering = customDragState.isDragging && customDragState.currentlyHovering !== null;
  
  const formattedDate = format(currentDate, "yyyy-MM-dd");
  
  return (
    <div className="relative h-full overflow-hidden flex flex-col" ref={containerRef}>
      {/* Edge indicators - simplified */}
      {customDragState.isDragging && (
        <>
          {/* Left edge indicator */}
          <div className={cn(
            "absolute left-0 top-0 h-full w-[20%] z-10 pointer-events-none",
            "bg-gradient-to-r from-blue-300/30 to-transparent transition-opacity duration-150",
            customDragState.currentlyHovering === 'left' ? "opacity-100" : "opacity-0"
          )}>
            {customDragState.currentlyHovering === 'left' && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-blue-500 rounded-full p-2 shadow-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 19L8 12L15 5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
          
          {/* Right edge indicator */}
          <div className={cn(
            "absolute right-0 top-0 h-full w-[20%] z-10 pointer-events-none",
            "bg-gradient-to-l from-blue-300/30 to-transparent transition-opacity duration-150",
            customDragState.currentlyHovering === 'right' ? "opacity-100" : "opacity-0"
          )}>
            {customDragState.currentlyHovering === 'right' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-blue-500 rounded-full p-2 shadow-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 5L16 12L9 19" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        </>
      )}

      {/* Day displacement indicator */}
      {customDragState.isDragging && dayOffset !== 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-3 py-1 rounded-full shadow-md text-sm font-medium">
          {dayOffset > 0 ? `+${dayOffset}` : dayOffset} days
        </div>
      )}

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
          isEdgeHovering && "opacity-80" // Simple visual feedback when edge hovering
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
          <div 
            className={cn(
              "space-y-3 relative",
              customDragState.isDragging && "pb-10" // Additional padding during drag
            )}
          >
            {dayEvents.map((event, index) => (
              <div
                key={event.id}
                className={cn(
                  "relative",
                  // If this is the drop target while dragging, show insertion indicator
                  customDragState.dropTargetId === event.id && "before:absolute before:left-0 before:right-0 before:h-1 before:bg-blue-400 before:rounded before:-top-2 before:z-10 before:animate-pulse"
                )}
              >
                <EventCard
                  event={event}
                  isSource={customDragState.event?.id === event.id}
                  isDraggable={!customDragState.isDragging || customDragState.event?.id === event.id}
                  isDropTarget={customDragState.dropTargetId === event.id}
                  onClick={() => onEventClick(event)}
                  onMouseDown={(e) => handlePointerDown(event, e)}
                  onTouchStart={(e) => handlePointerDown(event, e)}
                  onMouseUp={() => handlePointerUp(event)}
                  onTouchEnd={() => handlePointerUp(event)}
                  onMouseLeave={handlePointerLeave}
                />
              </div>
            ))}
            
            {/* Space at the bottom that can receive drops during drag */}
            {customDragState.isDragging && (
              <div 
                className={cn(
                  "h-20 mt-2 bg-transparent",
                  // Highlight when hovering over the bottom area with no specific target
                  customDragState.isDragging && 
                  !customDragState.dropTargetId && 
                  formattedDate === format(currentDate, "yyyy-MM-dd") && 
                  "border-2 border-dashed border-blue-200 rounded-md"
                )}
                data-drop-zone="bottom"
              />
            )}
            
            {/* Extra padding at the bottom for comfortable scrolling */}
            <div className="h-10"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarDayView; 