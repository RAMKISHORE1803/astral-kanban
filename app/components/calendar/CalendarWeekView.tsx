"use client";

import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { KanbanEvent } from "@/app/lib/utils";
import CalendarDay from "./CalendarDay";

interface CalendarWeekViewProps {
  currentDate: Date;
  eventsByDate: { [date: string]: KanbanEvent[] };
  customDragState: {
    isDragging: boolean;
  };
  onEventClick: (event: KanbanEvent) => void;
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
}

const CalendarWeekView = ({
  currentDate,
  eventsByDate,
  customDragState,
  onEventClick,
  onEventMouseDown
}: CalendarWeekViewProps) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

  return (
    <div className="grid grid-cols-7 h-[90vh] border-t border-l border-slate-200">
      {weekDays.map(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayEvents = eventsByDate[dateStr] || [];
        const isToday = isSameDay(day, new Date());
        // Highlight the whole week grid slightly if dragging is happening anywhere
        const isHighlighted = customDragState.isDragging;

        return (
          <CalendarDay
            key={dateStr}
            dateStr={dateStr}
            day={day}
            isToday={isToday}
            isHighlighted={isHighlighted} 
            events={dayEvents}
            onEventMouseDown={onEventMouseDown}
            onEventClick={onEventClick}
          />
        );
      })}
    </div>
  );
};

export default CalendarWeekView; 