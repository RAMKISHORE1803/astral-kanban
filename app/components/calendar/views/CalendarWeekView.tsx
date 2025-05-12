"use client";

import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { cn } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import EventCard from "../EventCard";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarWeekViewProps, ColumnProps } from "@/app/types/calendar";

const Column = ({
  dateStr,
  dayName,
  dayNumber,
  isToday,
  events,
  onEventClick,
  onEventMouseDown,
  customDragState,
  isDropTarget,
  isFirstOfMonth,
  monthShort
}: ColumnProps) => {
  return (
    <div 
      className={cn(
        "flex flex-col border-r border-b border-slate-200 transition-colors duration-200 h-full overflow-hidden",
        isToday ? "bg-blue-50" : "bg-white",
        isDropTarget ? "bg-blue-50/50" : ""
      )}
      data-date={dateStr}
    >
      {/* Column header - sticky */}
      <div className="text-center py-3 border-b border-slate-200 sticky top-0 bg-white z-10 shadow-sm">
        <div className="text-xs text-slate-500 font-medium">{dayName}</div>
        
        {/* Date indicator with month on left side */}
        <div className="flex items-center justify-center mt-1 gap-1">
          {isFirstOfMonth && (
            <span className="text-xs text-slate-400 font-medium">
              {monthShort}
            </span>
          )}
          <div className={cn(
            "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm",
            isToday && "bg-blue-500 text-white font-medium"
          )}>
            {dayNumber}
          </div>
        </div>
      </div>
      
      {/* Column content - scrollable */}
      <div 
        className={cn(
          "flex-1 p-1.5 space-y-1.5 overflow-y-auto",
          "scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent",
          "relative"
        )}
        style={{
          height: "calc(100% - 65px)", 
          maxHeight: "calc(100% - 65px)",
        }}
      >
        {/* Scroll indicator shadow at the top - only visible when scrolled */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-top"></div>
        
        {/* Events container */}
        <div className="relative">
          {events.length > 0 ? (
            events.map(event => (
              <div 
                key={event.id} 
                className={cn(
                  "event-card",
                  customDragState.isDragging && customDragState.event?.id === event.id ? "opacity-30" : ""
                )}
                data-event-id={event.id}
              >
                <EventCard
                  event={event}
                  onClick={() => onEventClick(event)}
                  isDraggable={true}
                  isCompact={true}
                  onDragHandleMouseDown={(e) => onEventMouseDown(event, e)}
                  onDragHandleTouchStart={(e) => onEventMouseDown(event, e)}
                />
              </div>
            ))
          ) : (
            <div className="h-20 flex items-center justify-center text-slate-300 text-xs">
              No events
            </div>
          )}
        </div>
        
        {/* Add a bottom area as a drop zone */}
        <div 
          className="h-20 mt-2" 
          data-drop-zone="bottom"
          data-date={dateStr}
        />
        
        {/* Scroll indicator shadow at the bottom - only visible when more content is available */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-bottom"></div>
      </div>
    </div>
  );
};

const CalendarWeekView = ({
  currentDate,
  eventsByDate,
  customDragState,
  onEventClick,
  onEventMouseDown
}: CalendarWeekViewProps) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });
  
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [edgeHover, setEdgeHover] = useState<'left' | 'right' | null>(null);

  // Effect for handling drop targets when dragging
  useEffect(() => {
    if (!customDragState.isDragging || !customDragState.position) {
      setDropTargetDate(null);
      setEdgeHover(null);
      return;
    }

    const { x, y } = customDragState.position;
    
    // Handle edge detection for week navigation
    const container = document.querySelector('.calendar-week-view');
    if (container) {
      const rect = container.getBoundingClientRect();
      // Use 7% of container width for more reliable edge detection
      const edgeWidth = Math.max(rect.width * 0.07, 30); 
      
      if (x < rect.left + edgeWidth) {
        if (edgeHover !== 'left') {
          console.log('[WeekView] Detected LEFT edge hover');
          setEdgeHover('left');
        }
        return;
      } else if (x > rect.right - edgeWidth) {
        if (edgeHover !== 'right') {
          console.log('[WeekView] Detected RIGHT edge hover');
          setEdgeHover('right');
        }
        return;
      } else {
        if (edgeHover !== null) {
          console.log('[WeekView] Edge hover ended');
          setEdgeHover(null);
        }
      }
    }
    
    // Normal column detection
    const elementsAtPoint = document.elementsFromPoint(x, y);
    const columnElement = elementsAtPoint.find(el => el.hasAttribute('data-date') || el.closest('[data-date]'));
    
    if (columnElement) {
      const dateAttr = columnElement.getAttribute('data-date') || 
                      columnElement.closest('[data-date]')?.getAttribute('data-date');
      
      if (dateAttr) {
        setDropTargetDate(dateAttr);
      }
    } else {
      setDropTargetDate(null);
    }
  }, [customDragState.isDragging, customDragState.position]);

  // Convert edge hover to the format expected by the parent component
  useEffect(() => {
    if (customDragState.isDragging) {
      const newHoverState = edgeHover;
      if (newHoverState !== customDragState.currentlyHovering) {
        console.log(`[WeekView] Dispatching edge hover event: ${newHoverState}`);
        
        // Dispatch the event to notify the CalendarContainer
        document.dispatchEvent(
          new CustomEvent('weekViewEdgeHover', { 
            detail: { edge: newHoverState } 
          })
        );
      }
    }
  }, [edgeHover, customDragState.isDragging, customDragState.currentlyHovering]);

  // Existing effect for scroll shadows
  useEffect(() => {
    const scrollContainers = document.querySelectorAll('.calendar-week-view .overflow-y-auto');
    
    const handleScroll = (event: Event) => {
      const container = event.currentTarget as HTMLElement;
      const topShadow = container.querySelector('.scroll-shadow-top');
      const bottomShadow = container.querySelector('.scroll-shadow-bottom');
      
      if (topShadow && bottomShadow) {
        if (container.scrollTop > 10) {
          topShadow.classList.add('opacity-100');
        } else {
          topShadow.classList.remove('opacity-100');
        }
        
        if (container.scrollHeight > container.clientHeight && 
            container.scrollTop < (container.scrollHeight - container.clientHeight - 10)) {
          bottomShadow.classList.add('opacity-100');
        } else {
          bottomShadow.classList.remove('opacity-100');
        }
      }
    };
    
    scrollContainers.forEach(container => {
      container.addEventListener('scroll', handleScroll);
      // Initialize state on mount
      handleScroll({ currentTarget: container } as unknown as Event);
    });
    
    return () => {
      scrollContainers.forEach(container => {
        container.removeEventListener('scroll', handleScroll);
      });
    };
  }, [eventsByDate]); // Re-attach when events change

  // Use directly rendered events from props without the DND Kit
  return (
    <div className="grid grid-cols-7 h-[85vh] border-t border-l border-slate-200 calendar-week-view relative">
      {/* Edge indicators for week navigation */}
      <AnimatePresence>
        {customDragState.isDragging && (
          <>
            {/* Left edge indicator - Previous Week */}
            <motion.div 
              className={cn(
                "absolute left-0 top-0 bottom-0 z-30 pointer-events-none flex items-center",
                "bg-gradient-to-r from-blue-500/20 to-transparent"
              )}
              initial={{ width: "0%", opacity: 0 }}
              animate={{ 
                width: edgeHover === 'left' ? "8%" : "4%",
                opacity: edgeHover === 'left' ? 1 : 0.6
              }}
              exit={{ width: "0%", opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className={cn(
                  "absolute left-3 p-3 rounded-full bg-blue-500 shadow-lg",
                  edgeHover === 'left' ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  scale: edgeHover === 'left' ? [1, 1.1, 1] : 1,
                  x: edgeHover === 'left' ? [-5, 0, -5] : 0
                }}
                transition={{ 
                  repeat: edgeHover === 'left' ? Infinity : 0,
                  duration: 1.5
                }}
              >
                <ChevronLeft className="text-white" size={20} />
              </motion.div>
            </motion.div>
            
            {/* Right edge indicator - Next Week */}
            <motion.div 
              className={cn(
                "absolute right-0 top-0 bottom-0 z-30 pointer-events-none flex items-center justify-end",
                "bg-gradient-to-l from-blue-500/20 to-transparent"
              )}
              initial={{ width: "0%", opacity: 0 }}
              animate={{ 
                width: edgeHover === 'right' ? "8%" : "4%", 
                opacity: edgeHover === 'right' ? 1 : 0.6
              }}
              exit={{ width: "0%", opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div 
                className={cn(
                  "absolute right-3 p-3 rounded-full bg-blue-500 shadow-lg",
                  edgeHover === 'right' ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  scale: edgeHover === 'right' ? [1, 1.1, 1] : 1,
                  x: edgeHover === 'right' ? [5, 0, 5] : 0
                }}
                transition={{ 
                  repeat: edgeHover === 'right' ? Infinity : 0, 
                  duration: 1.5
                }}
              >
                <ChevronRight className="text-white" size={20} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {weekDays.map((day, index) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayEvents = eventsByDate[dateStr] || [];
        const isToday = isSameDay(day, new Date());
        const dayName = format(day, "EEE");
        const dayNumber = format(day, "d");
        const monthShort = format(day, "MMM");
        const isDropTarget = dropTargetDate === dateStr;
        
        // Check if this day is the first day of a month
        const isFirstOfMonth = day.getDate() === 1;
        
        // Special case: Also show month indicator for the first day of the week
        // if it's not the first day of a month
        const isFirstOfWeek = index === 0;
        const shouldShowMonth = isFirstOfMonth || isFirstOfWeek;

        return (
          <Column
            key={dateStr}
            dateStr={dateStr}
            dayName={dayName}
            dayNumber={dayNumber}
            isToday={isToday}
            events={dayEvents}
            onEventClick={onEventClick}
            onEventMouseDown={onEventMouseDown}
            customDragState={customDragState}
            isDropTarget={isDropTarget}
            isFirstOfMonth={shouldShowMonth}
            monthShort={monthShort}
          />
        );
      })}
    </div>
  );
};

export default CalendarWeekView; 