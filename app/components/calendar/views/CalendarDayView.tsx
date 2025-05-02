"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import EventCard from "../EventCard";
import { cn } from "@/app/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KanbanEvent, CalendarDayViewProps, CustomDragState, DebugInfo } from "@/app/types/calendar";

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
  const [isScrolling, setIsScrolling] = useState(false);
  
  // State for long press detection
  const [pressedEvent, setPressedEvent] = useState<KanbanEvent | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref to store the current date to detect changes
  const prevDateRef = useRef(currentDate);

  // Reference to content area for scrolling
  const contentRef = useRef<HTMLDivElement>(null);
  
  // State for custom scrollbar
  const [scrollThumbState, setScrollThumbState] = useState({
    thumbHeight: 0,
    thumbTop: 0,
    isScrolling: false, // Track if the main content is scrolling
    isVisible: false, // Whether the custom scrollbar should be visible
  });
  const [isThumbDragging, setIsThumbDragging] = useState(false);
  const thumbDragRef = useRef({ startY: 0, startScrollTop: 0 });
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer to hide scrollbar

  // Effect to handle date changes
  useEffect(() => {
    // Only run this effect if the date actually changed (not on initial mount)
    if (prevDateRef.current && prevDateRef.current !== currentDate) {
      // If we're in the middle of a drag operation during date change,
      // we want to ensure events are rendered immediately with no opacity transitions
      if (customDragState.isDragging) {
        // We could add special handling here if needed
        console.log("Date changed during drag");
      }
    }
    
    // Update ref with current date
    prevDateRef.current = currentDate;
  }, [currentDate, customDragState.isDragging]);
  
  // Clear any active press timers
  const clearPressTimer = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  // Handle initial touch down
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
    setIsScrolling(false);
    
    // Start long press timer for drag initiation
    pressTimerRef.current = setTimeout(() => {
      onEventMouseDown(event, e);
      setPressedEvent(null);
      setTouchStartPos(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, customDragState.isDragging, onEventMouseDown]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos || customDragState.isDragging) return;
    
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.y);
    const deltaX = Math.abs(e.touches[0].clientX - touchStartPos.x);
    
    // If vertical movement exceeds threshold, consider it scrolling
    if (deltaY > SCROLL_THRESHOLD && deltaY > deltaX) {
      setIsScrolling(true);
      clearPressTimer();
    }
  }, [touchStartPos, customDragState.isDragging, clearPressTimer]);

  // Handle touch end - if no scrolling was detected, treat as a click
  const handleTouchEnd = useCallback((event: KanbanEvent) => {
    // Check if it was a tap that wasn't a scroll or drag start
    if (pressedEvent?.id === event.id && !isScrolling && !customDragState.isDragging) {
      // It was a tap, but we don't trigger the modal here anymore.
      // The click/tap is handled by the EventCard itself (specifically the button).
      clearPressTimer(); 
    }
    // Always clear state regardless
    setPressedEvent(null);
    setTouchStartPos(null);
    setIsScrolling(false);
  }, [clearPressTimer, pressedEvent, isScrolling, customDragState.isDragging]);

  // Handle touch cancel - clear any pending actions
  const handleTouchCancel = useCallback(() => {
    clearPressTimer();
    setPressedEvent(null);
    setTouchStartPos(null);
    setIsScrolling(false);
  }, [clearPressTimer]);
  
  // Mouse events - simpler since scrolling is usually handled by wheel events
  const handleMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent) => {
    if (customDragState.isDragging) return;
    
    e.stopPropagation();
    clearPressTimer();
    setPressedEvent(event);
    
    // Only set timer if drag is possible (isDraggable is true on card, which we assume)
    pressTimerRef.current = setTimeout(() => { 
      onEventMouseDown(event, e);
      setPressedEvent(null);
    }, LONG_PRESS_DURATION);
  }, [clearPressTimer, customDragState.isDragging, onEventMouseDown]);

  // Mouse click - handle click event
  const handleClick = useCallback((event: KanbanEvent) => {
    if (customDragState.isDragging) return;
    
    // This function is now primarily called by the EventCard's onClick prop
    // (either the card itself in week view, or the button in day view)
    // We still clear the press timer in case a rapid mouse down/up occurred
    // before the long-press timer fired.
    clearPressTimer(); 
    onEventClick(event);
  }, [clearPressTimer, onEventClick]);
  
  // Simple function to check if we're hovering near an edge
  const isEdgeHovering = customDragState.isDragging && customDragState.currentlyHovering !== null;
  
  const formattedDate = format(currentDate, "yyyy-MM-dd");
  
  // Function to update thumb position and visibility
  const updateThumb = useCallback(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const { scrollTop, scrollHeight, clientHeight } = contentEl;
    const isScrollable = scrollHeight > clientHeight;

    if (!isScrollable) {
      setScrollThumbState(prev => prev.isVisible ? { ...prev, isVisible: false } : prev);
      return;
    }

    const minThumbHeight = 30; // Minimum pixels
    const calculatedThumbHeight = Math.max(minThumbHeight, clientHeight * (clientHeight / scrollHeight));
    const scrollableDist = scrollHeight - clientHeight;
    const thumbTravelDist = clientHeight - calculatedThumbHeight;
    const thumbTop = scrollableDist > 0 ? (scrollTop / scrollableDist) * thumbTravelDist : 0;

    setScrollThumbState(prev => ({
      ...prev, // Keep existing isScrolling state
      thumbHeight: calculatedThumbHeight,
      thumbTop: thumbTop,
      isVisible: true,
    }));
  }, []);

  // Effect to update thumb on resize or content change
  useLayoutEffect(() => {
    updateThumb(); // Initial update
    
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const observer = new ResizeObserver(updateThumb);
    observer.observe(contentEl);

    const mutationObserver = new MutationObserver(updateThumb);
    const config = { childList: true, subtree: true, characterData: true }; // Observe content changes
    mutationObserver.observe(contentEl, config);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [updateThumb, dayEvents]); // Rerun when events change, or updateThumb changes

  // Handle scrolling of the main content area
  const handleScroll = useCallback(() => {
    if (!isThumbDragging) { // Only update thumb if scroll wasn't initiated by thumb drag
      updateThumb();
    }
    // Indicate scrolling for visual feedback (e.g., show scrollbar)
    setScrollThumbState(prev => ({ ...prev, isScrolling: true }));
    
    // Clear previous timer
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    // Set new timer to hide scrollbar after scrolling stops
    scrollTimerRef.current = setTimeout(() => 
        setScrollThumbState(prev => ({ ...prev, isScrolling: false })), 
        1500
    );
  }, [updateThumb, isThumbDragging]);

  // --- Thumb Drag Handlers ---
  const handleThumbMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (!contentRef.current) return;

    setIsThumbDragging(true);
    thumbDragRef.current = {
      startY: e.clientY,
      startScrollTop: contentRef.current.scrollTop,
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, []);

  const handleThumbTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
     e.stopPropagation(); 
     if (!contentRef.current) return;

     setIsThumbDragging(true);
     thumbDragRef.current = {
       startY: e.touches[0].clientY,
       startScrollTop: contentRef.current.scrollTop,
     };
     document.body.style.userSelect = 'none';
   }, []);

  // Global move handler during thumb drag
  const handleThumbMove = useCallback((clientY: number) => {
    if (!isThumbDragging || !contentRef.current) return;

    const { startY, startScrollTop } = thumbDragRef.current;
    const deltaY = clientY - startY;

    const contentEl = contentRef.current;
    const { scrollHeight, clientHeight } = contentEl;
    const thumbHeight = scrollThumbState.thumbHeight; // Read from state

    if (scrollHeight <= clientHeight) return; // Not scrollable

    const scrollableDist = scrollHeight - clientHeight;
    const thumbTravelDist = clientHeight - thumbHeight;
    const deltaScroll = thumbTravelDist > 0 ? (deltaY / thumbTravelDist) * scrollableDist : 0;
    const newScrollTop = Math.max(0, Math.min(startScrollTop + deltaScroll, scrollableDist));

    contentEl.scrollTop = newScrollTop;
    // Manually update thumb state during drag
    const newThumbTop = thumbTravelDist > 0 ? (newScrollTop / scrollableDist) * thumbTravelDist : 0;
     setScrollThumbState(prev => ({
       ...prev,
       thumbTop: newThumbTop,
     }));
  }, [isThumbDragging, scrollThumbState.thumbHeight]);

  // Global end handler for thumb drag
  const handleThumbEnd = useCallback(() => {
    if (isThumbDragging) {
      setIsThumbDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isThumbDragging]);

  // Add/remove global listeners for thumb dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleThumbMove(e.clientY);
    const handleTouchMove = (e: TouchEvent) => handleThumbMove(e.touches[0].clientY);

    if (isThumbDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mouseup', handleThumbEnd);
      document.addEventListener('touchend', handleThumbEnd);
      document.addEventListener('mouseleave', handleThumbEnd); 
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleThumbEnd);
      document.removeEventListener('touchend', handleThumbEnd);
      document.removeEventListener('mouseleave', handleThumbEnd);
    };
  }, [isThumbDragging, handleThumbMove, handleThumbEnd]);

  return (
    <div className="relative h-full overflow-hidden flex flex-col" ref={containerRef}>
      {/* Simplified Edge indicators - arrows only, no text labels */}
      <AnimatePresence>
        {customDragState.isDragging && (
          <>
            {/* Left edge indicator - Previous Day (arrow only) */}
            <motion.div 
              className={cn(
                "absolute left-0 top-0 bottom-0 z-30 pointer-events-none flex items-center",
                "bg-gradient-to-r from-blue-500/20 to-transparent"
              )}
              initial={{ width: "0%", opacity: 0 }}
              animate={{ 
                width: customDragState.currentlyHovering === 'left' ? "15%" : "5%",
                opacity: customDragState.currentlyHovering === 'left' ? 1 : 0.5
              }}
              exit={{ width: "0%", opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Navigation arrow with animation */}
              <motion.div 
                className={cn(
                  "absolute left-3 p-3 rounded-full bg-blue-500 shadow-lg",
                  customDragState.currentlyHovering === 'left' ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  scale: customDragState.currentlyHovering === 'left' ? [1, 1.1, 1] : 1,
                  x: customDragState.currentlyHovering === 'left' ? [-5, 0, -5] : 0
                }}
                transition={{ 
                  repeat: customDragState.currentlyHovering === 'left' ? Infinity : 0,
                  duration: 1.5
                }}
              >
                <ChevronLeft className="text-white" size={20} />
              </motion.div>
            </motion.div>
            
            {/* Right edge indicator - Next Day (arrow only) */}
            <motion.div 
              className={cn(
                "absolute right-0 top-0 bottom-0 z-30 pointer-events-none flex items-center justify-end",
                "bg-gradient-to-l from-blue-500/20 to-transparent"
              )}
              initial={{ width: "0%", opacity: 0 }}
              animate={{ 
                width: customDragState.currentlyHovering === 'right' ? "15%" : "5%", 
                opacity: customDragState.currentlyHovering === 'right' ? 1 : 0.5
              }}
              exit={{ width: "0%", opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Navigation arrow with animation */}
              <motion.div 
                className={cn(
                  "absolute right-3 p-3 rounded-full bg-blue-500 shadow-lg",
                  customDragState.currentlyHovering === 'right' ? "opacity-100" : "opacity-70"
                )}
                animate={{
                  scale: customDragState.currentlyHovering === 'right' ? [1, 1.1, 1] : 1,
                  x: customDragState.currentlyHovering === 'right' ? [5, 0, 5] : 0
                }}
                transition={{ 
                  repeat: customDragState.currentlyHovering === 'right' ? Infinity : 0, 
                  duration: 1.5
                }}
              >
                <ChevronRight className="text-white" size={20} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Day displacement indicator - Shows how many days moved */}
      {/* <AnimatePresence>
        {customDragState.isDragging && dayOffset !== 0 && (
          <motion.div 
            className="absolute top-4 left-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg"
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
          >
            <span className="font-medium">{dayOffset > 0 ? `+${dayOffset}` : dayOffset} days</span>
          </motion.div>
        )}
      </AnimatePresence> */}

      {/* Day header - fixed at top */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <h3 className="text-lg font-medium text-gray-900">
          {format(currentDate, "EEEE, MMMM d, yyyy")}
        </h3>
      </div>

      {/* Wrapper for content and custom scrollbar */}
      <div className="flex-1 flex overflow-hidden relative h-full">

        {/* Main content container - scrollable */}
        <div 
          ref={contentRef}
          className={cn(
            "px-4 py-4 overflow-y-auto flex-1 calendar-day-view-content max-h-[85vh]",
            "min-h-0", // Allow shrinking below content size
            isEdgeHovering && "opacity-90 transition-opacity duration-200" // Fade content during edge hovering
          )}
          style={{
            overscrollBehavior: 'contain', // Prevent pull-to-refresh on iOS
            touchAction: customDragState.isDragging ? 'none' : 'auto', // Changed pan-y to auto when not dragging
          }}
          onScroll={handleScroll} // Re-enabled scroll listener
        >
          {dayEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No events for this day
            </div>
          ) : (
            <div className="space-y-3 relative pb-10">
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className="relative"
                  data-event-id={event.id}
                >
                  <EventCard
                    showViewDetailsButton={true}
                    event={event}
                    isSource={customDragState.event?.id === event.id}
                    isDraggable={!customDragState.isDragging || customDragState.event?.id === event.id}
                    isDropTarget={false}
                    onClick={() => handleClick(event)}
                    onMouseDown={(e) => handleMouseDown(event, e as React.MouseEvent)}
                    onTouchStart={(e) => handleTouchStart(event, e as React.TouchEvent)}
                    onTouchEnd={() => handleTouchEnd(event)}
                  />
                </div>
              ))}
              {/* Extra padding at the bottom for comfortable scrolling */}
              <div className="h-10"></div>
            </div>
          )}
        </div>
        
        {/* Scroll indicator tip - appears briefly when user first views the list */}
        {dayEvents.length > 3 && (
          <div className="scroll-indicator">
            <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none bg-gradient-to-t from-white to-transparent opacity-70" />
          </div>
        )}

        {/* Custom Scrollbar Area - Re-enabled */}
        {scrollThumbState.isVisible && (
           <div className="absolute top-16 right-0 bottom-0 w-2.5 flex justify-center py-1 pointer-events-none z-20">
             <div
                className="relative w-1.5 h-[calc(100%-4rem)] bg-slate-200 rounded-full opacity-50"
             >
               <div
                  className={cn(
                    "absolute left-0 w-full bg-slate-500 rounded-full cursor-grab active:cursor-grabbing",
                    "transition-opacity duration-200",
                    (scrollThumbState.isScrolling || isThumbDragging) ? "opacity-70" : "opacity-50 hover:opacity-70",
                    "pointer-events-auto"
                  )}
                  style={{
                    height: `${scrollThumbState.thumbHeight}px`,
                    top: `${scrollThumbState.thumbTop}px`,
                  }}
                  onMouseDown={handleThumbMouseDown}
                  onTouchStart={handleThumbTouchStart}
                />
             </div>
           </div>
        )}
      </div> {/* End Main content container */} 
    </div>
  );
};

export default CalendarDayView;