"use client";

import React from 'react';
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";
import { Clock, CalendarDays } from "lucide-react";
import type { KanbanEvent, EventCardProps as OriginalEventCardProps } from "@/app/types/calendar";

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

// Extend the original props type
interface EventCardProps extends OriginalEventCardProps {
  showViewDetailsButton?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  isSource = false,
  isDraggable = true,
  isDropTarget = false,
  showViewDetailsButton = false, // Default to false
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd
}) => {
  const colorIndex = simpleHash(event.id) % eventColors.length;
  const colorSet = eventColors[colorIndex];

  // Handler specifically for the "View Details" button
  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent card's onClick if it were to trigger
    if (onClick) {
      onClick(event);
    }
  };

  // Determine if the main card div should be clickable
  // It should be clickable ONLY if the button is NOT shown (Week View)
  const isCardClickable = !showViewDetailsButton;

  return (
    <motion.div
      className={cn(
        "relative z-0 group bg-white rounded-lg overflow-hidden cursor-grab active:cursor-grabbing touch-manipulation mb-2 hover:z-10",
        "border border-slate-200 shadow-sm hover:shadow-md transition-all duration-150",
        "flex flex-col",
        "event-card",
        isSource && !isDropTarget && "opacity-40"
      )}
      data-event-id={event.id}
      // Attach onClick to the main div ONLY if the button isn't shown
      onClick={isCardClickable && onClick ? () => onClick(event) : undefined}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      whileHover={{ y: -2 }}
      style={{
        touchAction: isDraggable ? 'pan-y' : 'auto',
      }}
    >
      {/* Image Section - Full width, consistent height */}
      {event.imageUrl && (
        <div className="relative h-24 w-full overflow-hidden"> 
          <img
            src={event.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            draggable="false"
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

            {/* Conditionally rendered View Details Button */}
            {showViewDetailsButton && (
              <div className="mt-3 pt-2 border-t border-slate-200/60">
                <button 
                  onClick={handleButtonClick}
                  className={cn(
                    "w-full text-center text-xs font-medium py-1.5 rounded",
                    colorSet.text, 
                    "bg-white/70 hover:bg-white transition-colors duration-150",
                    "focus:outline-none focus:ring-2 focus:ring-offset-1",
                    colorSet.border.replace('border-', 'focus:ring-') // Reuse border color for focus ring
                  )}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default React.memo(EventCard); 