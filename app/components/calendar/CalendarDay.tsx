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
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
  onEventClick: (event: KanbanEvent) => void;
}

export const CalendarDay = ({
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
            className="cursor-grab active:cursor-grabbing event-card mb-1" // Added mb-1
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

// Default export for convenience
export default CalendarDay; 