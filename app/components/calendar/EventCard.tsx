"use client";

import React from 'react';
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";
import { Clock, CalendarDays, GripVertical } from "lucide-react";
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
  isCompact?: boolean; // New prop for compact mode in week view
  onDragHandleMouseDown?: (e: React.MouseEvent) => void; // For the drag handle
  onDragHandleTouchStart?: (e: React.TouchEvent) => void; // For the drag handle
}

const EventCard: React.FC<EventCardProps> = ({
  event,
  isSource = false,
  isDraggable = true,
  isDropTarget = false,
  showViewDetailsButton = false, // Default to false
  isCompact = false, // Default to regular mode
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onDragHandleMouseDown,
  onDragHandleTouchStart
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

  // Handler specifically for drag handles
  const handleDragHandleMouseDown = (e: React.MouseEvent) => {
    // Make sure to capture the event properly
    e.stopPropagation();
    e.preventDefault();
    
    if (onDragHandleMouseDown) {
      // Pass the event through for dragging
      onDragHandleMouseDown(e);
    }
  };

  // Handler specifically for drag handles (touch)
  const handleDragHandleTouchStart = (e: React.TouchEvent) => {
    // Make sure to capture the event properly
    e.stopPropagation();
    e.preventDefault(); // Add preventDefault to stop any default touch behavior
    
    if (onDragHandleTouchStart) {
      // Pass the event through for dragging
      onDragHandleTouchStart(e);
    }
  };

  // For week view, use a more compact layout
  if (isCompact) {
    return (
      <motion.div
        className={cn(
          "relative z-0 group bg-white rounded-md overflow-hidden cursor-default touch-manipulation mb-1 hover:z-10",
          "border border-slate-200 shadow-sm hover:shadow transition-all duration-150",
          "flex flex-col",
          "event-card",
          isSource && !isDropTarget && "opacity-40"
        )}
        data-event-id={event.id}
        // In week view, clicking the card should open the detail
        onClick={onClick ? () => onClick(event) : undefined}
        // Don't attach mouse/touch events to the whole card for dragging anymore
        whileHover={{ y: -1 }}
        style={{
          touchAction: isSource ? 'none' : 'auto', // Disable browser touch handling ONLY when dragging
        }}
      >
        {/* Simplified content for week view */}
        <div className={cn(
          "flex items-center px-2 py-1.5 gap-1.5 relative",
          colorSet.bg
        )}>
          {/* Left accent */}
          <div className={cn("h-full w-1 rounded-full self-stretch", colorSet.border)}></div>
          <div className="flex-1 min-w-0">
            {/* Title only - truncated */}
            <h3 className={cn("font-medium text-xs leading-tight truncate", colorSet.text)}>
              {event.title}
            </h3>
            
            {/* Just the time, no date */}
            <div className="flex items-center text-xs text-slate-600 mt-0.5">
              <span className="text-[10px] font-medium truncate">{event.time.toLowerCase()}</span>
            </div>
          </div>

          {/* Drag handle button - make even more prominent */}
          <div 
            className={cn(
              "absolute right-0 top-0 bottom-0 flex items-center justify-center w-8 bg-slate-100/90",
              isDraggable && "cursor-grab active:cursor-grabbing hover:bg-slate-200/90"
            )}
            onMouseDown={handleDragHandleMouseDown}
            onTouchStart={handleDragHandleTouchStart}
            style={{ touchAction: 'none' }} // Force disable browser touch actions on the handle
            aria-label="Drag event"
          >
            <GripVertical size={16} className="text-slate-600" />
          </div>
        </div>
      </motion.div>
    );
  }

  // Regular card for day view
  return (
    <motion.div
      className={cn(
        "relative z-0 group bg-white rounded-lg overflow-hidden cursor-default touch-manipulation mb-2 hover:z-10",
        "border border-slate-200 shadow-sm hover:shadow-md transition-all duration-150",
        "flex flex-col",
        "event-card",
        isSource && !isDropTarget && "opacity-50 scale-[0.99]", // Subtle scale and opacity for dragged card
        isSource && "z-20" // Higher z-index for the source card when dragging
      )}
      data-event-id={event.id}
      // Don't attach onClick to the main div, only the button should open detail panel
      // Don't attach drag related events to the card itself
      whileHover={isDraggable ? undefined : { y: -2 }}
      // Use faster animation transitions to feel more responsive
      transition={{ duration: 0.1 }}
      style={{
        touchAction: isSource ? 'none' : 'auto', // Disable browser touch handling ONLY when dragging
        willChange: 'transform', // Hardware acceleration hint
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
          
          {/* Drag handle in top right of image (if draggable) */}
          {isDraggable && (
            <div 
              className={cn(
                "absolute top-2 right-2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm",
                "flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md"
              )}
              onMouseDown={handleDragHandleMouseDown}
              onTouchStart={handleDragHandleTouchStart}
              style={{ touchAction: 'none' }} // Force disable browser touch actions on the handle
              aria-label="Drag event"
            >
              <GripVertical size={18} className="text-white" />
            </div>
          )}
        </div>
      )}
      
      {/* Content Section */}
      <div className={cn(
        "flex flex-col p-3 relative", // Added relative for drag handle positioning
        colorSet.bg
      )}>
        {/* Drag handle (only visible if no image) */}
        {isDraggable && !event.imageUrl && (
          <div 
            className={cn(
              "absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-100 shadow-sm",
              "flex items-center justify-center cursor-grab active:cursor-grabbing"
            )}
            onMouseDown={handleDragHandleMouseDown}
            onTouchStart={handleDragHandleTouchStart}
            style={{ touchAction: 'none' }} // Force disable browser touch actions on the handle
            aria-label="Drag event"
          >
            <GripVertical size={16} className="text-slate-500" />
          </div>
        )}
        
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