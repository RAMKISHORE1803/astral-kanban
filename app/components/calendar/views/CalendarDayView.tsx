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
const LONG_PRESS_DURATION = 400; // ms for mobile long press to initiate drag


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
  // State for touch handling
  const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number} | null>(null);

  // State for long press detection
  const [pressedEvent, setPressedEvent] = useState<KanbanEvent | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

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
  
 
  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  /**
   * Handle initial touch down
   * Starts long press timer for drag initiation
   */
  const handleTouchStart = useCallback((event: KanbanEvent, e: React.TouchEvent) => {
    if (customDragState.isDragging) return;
    
    e.stopPropagation();
    clearPressTimer();
    setPressedEvent(event);
    
    // Record starting touch position
    setTouchStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
    
    // Start long press timer for drag initiation
    pressTimerRef.current = setTimeout(() => {
      onEventMouseDown(event, e);
      setPressedEvent(null);
      setTouchStartPos(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, customDragState.isDragging, onEventMouseDown]);

  /**
   * Handle touch move
   * Cancels long press if movement exceeds threshold
   */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos || customDragState.isDragging) return;

    // Check if touch has moved significantly enough to cancel the long press
    const movedEnough = Math.abs(e.touches[0].clientY - touchStartPos.y) > SCROLL_THRESHOLD ||
                      Math.abs(e.touches[0].clientX - touchStartPos.x) > SCROLL_THRESHOLD;

    if (movedEnough) {
        clearPressTimer(); // Cancel long press if finger moves too much
    }
  }, [touchStartPos, customDragState.isDragging, clearPressTimer]);

  /**
   * Handle touch end
   * Manages state cleanup and potential click events
   */
  const handleTouchEnd = useCallback((event: KanbanEvent) => {
    // Check if it was a tap that wasn't a drag start
    if (pressedEvent?.id === event.id && !customDragState.isDragging) {
      clearPressTimer();
    }
    // Always clear state regardless
    setPressedEvent(null);
    setTouchStartPos(null);
  }, [clearPressTimer, pressedEvent, customDragState.isDragging]);

  /**
   * Handle touch cancel
   * Cleans up any pending actions
   */
  const handleTouchCancel = useCallback(() => {
    clearPressTimer();
    setPressedEvent(null);
    setTouchStartPos(null);
  }, [clearPressTimer]);
  
  /**
   * Handle mouse down event
   * Starts long press timer for drag initiation
   */
  const handleMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent) => {
    if (customDragState.isDragging) return;
    
    e.stopPropagation();
    clearPressTimer();
    setPressedEvent(event);
    
    // Start timer for drag initiation
    pressTimerRef.current = setTimeout(() => { 
      onEventMouseDown(event, e);
      setPressedEvent(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, customDragState.isDragging, onEventMouseDown]);

  /**
   * Handle click event
   * Passes click to parent component after clearing any pending timers
   */
  const handleClick = useCallback((event: KanbanEvent) => {
    if (customDragState.isDragging) return;
    
    clearPressTimer(); 
    onEventClick(event);
  }, [clearPressTimer, onEventClick]);
  
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
    <div className="flex flex-col overflow-hidden border border-red-500" style={{height: "600px"}} ref={containerRef}>
      {/* Day header - fixed at top */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h3 className="text-lg font-medium text-gray-900">
          Scrolling Test - 100 Numbers
        </h3>
      </div>

      {/* Scrollable Content - Using the same approach as in CalendarWeekView */}
      <div 
        ref={contentRef}
        className="overflow-y-auto p-4 relative bg-gray-100"
        style={{
          height: "calc(100% - 56px)", /* Calculated height based on parent height minus header */
          maxHeight: "calc(100% - 56px)"
        }}
      >
        {/* Scroll shadow indicators */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-top"></div>
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-bottom"></div>
        
        {/* Simple test content: 100 numbered items */}
        <div className="space-y-3 pb-10">
          {Array.from({ length: 100 }, (_, i) => (
            <div 
              key={i} 
              className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm"
            >
              <div className="text-lg font-medium">Item #{i + 1}</div>
              <div className="text-sm text-slate-500">This is a test item for scrolling</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarDayView;