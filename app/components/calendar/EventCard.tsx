"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { KanbanEvent } from "@/app/lib/utils";
import { cn } from "@/app/lib/utils";
import { Clock, CalendarDays } from "lucide-react";

interface EventCardProps {
  event: KanbanEvent;
  onClick: (event: KanbanEvent) => void;
}

// Simple hash function for color generation
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Define modern color scheme
const eventColors = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300" },
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-300" },
];

const EventCard = ({ event, onClick }: EventCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: event.id, disabled: false });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // Use instant transition while dragging, but smooth reposition otherwise
    transition: isDragging
      ? transition
      : 'transform 200ms ease-out, opacity 200ms ease-out',
    opacity: isDragging ? 0.8 : 1,
    touchAction: 'none',
    ...(isDragging ? { zIndex: 10 } : {}),
  };

  const colorIndex = simpleHash(event.id) % eventColors.length;
  const colorSet = eventColors[colorIndex];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative z-0 group bg-white rounded-lg overflow-hidden cursor-grab active:cursor-grabbing touch-manipulation mb-2 hover:z-10",
        "border border-slate-200 shadow-sm hover:shadow-md transition-all duration-150",
        "flex flex-col",
        isDragging && "shadow-lg ring-2 ring-blue-400 rotate-1 scale-[1.02]"
      )}
      onClick={(e) => {
        // Prevent drag from interfering with click
        if (!isDragging) {
          onClick(event);
        }
      }}
      layout
      whileHover={{ y: -2 }}
    >
      {/* Image Section - Full width, consistent height */}
      {event.imageUrl && (
        <div className="relative h-24 w-full overflow-hidden"> 
          <img
            src={event.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      )}
      
      {/* Content Section */}
      <div className={cn(
        "flex flex-col p-3",
        colorSet.bg
      )}>
        {/* Title with left border accent */}
        <div className="flex items-start gap-2">
          <div className={cn("h-full w-1 rounded-full self-stretch", colorSet.border)}></div>
          <div className="flex-1">
            <h3 className={cn("font-medium leading-tight", colorSet.text)}>
              {event.title}
            </h3>
            
            {/* Time and details */}
            <div className="mt-2 flex items-center text-xs text-slate-600 gap-3">
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                <span className="font-medium">{event.time.toLowerCase()}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarDays size={12} className="text-slate-400" />
                <span>{event.date}</span>
              </div>
            </div>
            
            {/* Description with better truncation */}
            <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EventCard; 