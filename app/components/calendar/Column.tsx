"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { KanbanEvent } from "@/app/lib/utils";
import EventCard from "./EventCard";

interface ColumnProps {
  id: string;
  title: string;
  events: KanbanEvent[];
  onEventClick: (event: KanbanEvent) => void;
}

const Column = ({ id, title, events, onEventClick }: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const getColumnStyle = () => {
    if (isOver) {
      return "bg-astral-light-gray/70 border-astral-blue/30";
    }
    return "bg-astral-light-gray/40";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center">
          <span>{title}</span>
          <span className="ml-2 bg-astral-light-gray text-xs rounded-full px-2 py-0.5">
            {events.length}
          </span>
        </h3>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-2 rounded-astral border border-transparent transition-colors overflow-y-auto ${getColumnStyle()}`}
      >
        <SortableContext
          items={events.map((event) => event.id)}
          strategy={verticalListSortingStrategy}
        >
          {events.length === 0 ? (
            <motion.div
              className="text-center py-6 text-slate-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Drop items here
            </motion.div>
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onClick={onEventClick}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default Column; 