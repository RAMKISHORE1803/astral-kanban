"use client";

import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { cn } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import EventCard from "../EventCard";
import type { CalendarWeekViewProps, ColumnProps } from "@/app/types/calendar";

// Column component for each day
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
  
  // Track which column is the drop target
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  // Update drop target date based on cursor position
  useEffect(() => {
    if (!customDragState.isDragging || !customDragState.position) {
      setDropTargetDate(null);
      return;
    }

    const { x, y } = customDragState.position;
    
    // Find the column under the cursor
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

  // Add scroll shadow effect on scroll
  useEffect(() => {
    const scrollContainers = document.querySelectorAll('.calendar-week-view .overflow-y-auto');
    
    const handleScroll = (event: Event) => {
      const container = event.currentTarget as HTMLElement;
      const topShadow = container.querySelector('.scroll-shadow-top');
      const bottomShadow = container.querySelector('.scroll-shadow-bottom');
      
      if (topShadow && bottomShadow) {
        // Show top shadow when scrolled down
        if (container.scrollTop > 10) {
          topShadow.classList.add('opacity-100');
        } else {
          topShadow.classList.remove('opacity-100');
        }
        
        // Show bottom shadow when more content is available to scroll
        if (container.scrollHeight > container.clientHeight && 
            container.scrollTop < (container.scrollHeight - container.clientHeight - 10)) {
          bottomShadow.classList.add('opacity-100');
        } else {
          bottomShadow.classList.remove('opacity-100');
        }
      }
    };
    
    // Initialize scroll shadows
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
    <div className="grid grid-cols-7 h-[85vh] border-t border-l border-slate-200 calendar-week-view">
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