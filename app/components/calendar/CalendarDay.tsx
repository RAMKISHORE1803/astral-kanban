"use client";

import { format } from "date-fns";
import { KanbanEvent } from "@/app/lib/utils";
import EventCard from "./EventCard";
import { cn } from "@/app/lib/utils";

// Helper component for rendering a day
export interface CalendarDayProps {
  dateStr: string;
  day: Date;
  isToday: boolean;
  isHighlighted: boolean;
  events: KanbanEvent[];
  isDragging?: boolean;
  isDragSource?: boolean;
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
  onEventClick: (event: KanbanEvent) => void;
}

export const CalendarDay = ({
  dateStr,
  day,
  isToday,
  isHighlighted,
  events,
  isDragging,
  isDragSource,
  onEventMouseDown,
  onEventClick
}: CalendarDayProps) => {
  const dayName = format(day, "EEE");
  const dayNumber = format(day, "d");
  
  return (
    <div 
      className={cn(
        "flex flex-col h-full border-r border-b border-slate-200 p-1 relative transition-colors duration-100",
        isToday ? "bg-blue-50" : "bg-white",
        isHighlighted && !isDragSource && "bg-blue-50/50",
        isDragSource && "bg-blue-100/70",
      )}
      data-date={dateStr}
    >
      <div className="text-center py-2">
        <div className="text-xs text-slate-500 font-medium">{dayName}</div>
        <div className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-full mt-1 text-sm",
          isToday && "bg-blue-500 text-white font-medium"
        )}>
          {dayNumber}
        </div>
      </div>
      
      <div className={cn(
        "flex-1 overflow-auto space-y-1 py-1 relative",
        isDragging && "pointer-events-none" // Disable event interactions during drag
      )}>
        {events.map(event => (
          <div 
            key={event.id} 
            className={cn(
              "event-item event-card",
              isDragging && !isDragSource && "opacity-70"
            )}
            data-event-id={event.id}
          >
            <EventCard
              event={event}
              onClick={() => !isDragging && onEventClick(event)}
              onMouseDown={(e) => onEventMouseDown(event, e)}
              onTouchStart={(e) => onEventMouseDown(event, e)}
              isSource={isDragSource && event.date === dateStr}
              isDraggable={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Default export for convenience
export default CalendarDay; 