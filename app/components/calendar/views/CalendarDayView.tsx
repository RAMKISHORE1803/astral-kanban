"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import EventCard from "../EventCard";
import { cn } from "@/app/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KanbanEvent, CalendarDayViewProps } from "@/app/types/calendar";

// Constants
const SCROLL_THRESHOLD = 10; // pixels of vertical movement to detect scroll intent

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
  // Ref to store the current date to detect changes
  const prevDateRef = useRef(currentDate);

  // Reference to content area
  const contentRef = useRef<HTMLDivElement>(null);

  // Effect to handle date changes
  useEffect(() => {
    // Only run this effect if the date actually changed (not on initial mount)
    if (prevDateRef.current && prevDateRef.current !== currentDate) {
      if (customDragState.isDragging) {
        console.log("Date changed during drag");
      }
    }
    
    // Update ref with current date
    prevDateRef.current = currentDate;
  }, [currentDate, customDragState.isDragging]);
  
  /**
   * Handle click event
   * Only used by the "View Details" button, not the whole card
   */
  const handleClick = useCallback((event: KanbanEvent) => {
    if (customDragState.isDragging) return;
    onEventClick(event);
  }, [onEventClick, customDragState.isDragging]);
  
  // Check if we're hovering near an edge during drag
  const isEdgeHovering = customDragState.isDragging && customDragState.currentlyHovering !== null;

  // Add scroll shadow effect for content area
  useEffect(() => {
    const scrollContainer = contentRef.current;
    
    const handleScroll = () => {
      if (!scrollContainer) return;
      
      const topShadow = scrollContainer.querySelector('.scroll-shadow-top');
      const bottomShadow = scrollContainer.querySelector('.scroll-shadow-bottom');
      
      if (topShadow && bottomShadow) {
        // Show top shadow when scrolled down
        if (scrollContainer.scrollTop > 10) {
          topShadow.classList.add('opacity-100');
        } else {
          topShadow.classList.remove('opacity-100');
        }
        
        // Show bottom shadow when more content is available to scroll
        if (scrollContainer.scrollHeight > scrollContainer.clientHeight && 
            scrollContainer.scrollTop < (scrollContainer.scrollHeight - scrollContainer.clientHeight - 10)) {
          bottomShadow.classList.add('opacity-100');
        } else {
          bottomShadow.classList.remove('opacity-100');
        }
      }
    };
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      // Initialize state on mount
      handleScroll();
    }
    
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [dayEvents]);

  return (
    <div className="flex flex-col h-full overflow-hidden" ref={containerRef}>
      {/* Edge indicators for navigation during drag */}
      <AnimatePresence>
        {customDragState.isDragging && (
          <>
            {/* Left edge indicator - Previous Day */}
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
            
            {/* Right edge indicator - Next Day */}
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

      {/* Day header - fixed at top */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h3 className="text-lg font-medium text-gray-900">
          {format(currentDate, "EEEE, MMMM d, yyyy")}
        </h3>
      </div>

      {/* Scrollable Content - Using the same approach as in CalendarWeekView */}
      <div 
        ref={contentRef}
        className="overflow-y-auto p-4 relative"
        style={{
          height: "calc(100% - 56px)", /* Calculated height based on parent height minus header */
          maxHeight: "calc(100% - 56px)"
        }}
      >
        {/* Scroll shadow indicators */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-top"></div>
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-bottom"></div>
        
        {dayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
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
                  showViewDetailsButton={true}
                  event={event}
                  isSource={customDragState.event?.id === event.id}
                  isDraggable={!customDragState.isDragging || customDragState.event?.id === event.id}
                  isDropTarget={false}
                  onClick={handleClick}
                  onMouseDown={(e) => onEventMouseDown(event, e)}
                  onTouchStart={(e) => onEventMouseDown(event, e)}
                  onTouchEnd={() => {}}
                />
              </div>
            ))}
            {/* Significantly increased bottom padding to ensure more than enough space */}
            <div className="h-36 md:h-28"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarDayView;