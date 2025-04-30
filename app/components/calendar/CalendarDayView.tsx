"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { KanbanEvent } from "@/app/lib/utils";
import EventCard from "./EventCard";
import { cn } from "@/app/lib/utils";

interface CalendarDayViewProps {
  currentDate: Date;
  dayEvents: KanbanEvent[];
  customDragState: {
    isDragging: boolean;
    event: KanbanEvent | null;
    position: { x: number, y: number } | null;
    startedOn: string | null;
    currentlyHovering: 'left' | 'right' | null;
    dropTargetId: string | null;
  };
  dayOffset: number;
  debugInfo: {
    transitionsAttempted: number;
    transitionsCompleted: number;
  };
  onEventClick: (event: KanbanEvent) => void;
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

// Constants
const LONG_PRESS_DURATION = 400; // milliseconds

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
  
  return (
    <div className="relative h-full overflow-hidden" ref={containerRef}>
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

      {/* Main content container - simplified */}
      <div className={cn(
        "p-4 overflow-y-auto h-full",
        isEdgeHovering && "opacity-80", // Simple visual feedback when edge hovering
        customDragState.isDragging && "touch-none" // Prevent touch actions during drag
      )}>
        {dayEvents.length === 0 ? (
          <p className="text-center text-slate-500 pt-10">No events scheduled.</p>
        ) : (
          <div className="space-y-2">
            {dayEvents.map(event => (
              <div
                key={event.id}
                onMouseDown={(e) => handlePointerDown(event, e)}
                onTouchStart={(e) => handlePointerDown(event, e)}
                onMouseUp={() => handlePointerUp(event)}
                onTouchEnd={() => handlePointerUp(event)}
                onMouseLeave={handlePointerLeave}
                className={cn(
                  "cursor-grab active:cursor-grabbing event-card select-none",
                  pressedEvent?.id === event.id && "opacity-90 scale-[0.98]",
                  customDragState.dropTargetId === event.id && "border-2 border-blue-500 rounded-lg",
                  customDragState.event?.id === event.id && "opacity-0" // Hide original when dragging
                )}
                data-event-id={event.id}
                style={{ 
                  touchAction: 'none', 
                  transition: customDragState.isDragging ? 'none' : 'transform 0.1s, opacity 0.1s' 
                }}
              >
                <EventCard
                  event={event}
                  onClick={() => {}} // Handled by our custom handlers
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarDayView; 