"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragMoveEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
} from "@dnd-kit/core";
import { 
    SortableContext, 
    verticalListSortingStrategy, 
    sortableKeyboardCoordinates 
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addHours, addDays, subDays } from "date-fns";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { KanbanEvent, createDateWithTime } from "@/app/lib/utils";
import EventCard from "./EventCard";
import EventDetail from "./EventDetail";
import sampleEventsContent from "@/app/lib/eventData";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import { cn } from "@/app/lib/utils";

// Droppable Day Component (Helper)
const DroppableDay = ({ id, children, isOver }: { id: string, children: React.ReactNode, isOver: boolean }) => {
  const { setNodeRef } = useDroppable({ id, data: { type: 'droppable-day' } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
          "flex flex-col bg-white border-r border-b border-slate-200 transition-colors",
          isOver && "bg-astral-light-gray/50"
      )}
    >
      {children}
    </div>
  );
};

interface CalendarContainerProps {
  currentDate: Date;
  view: "week" | "day";
  onDateChange: (date: Date) => void;
}

// Helper to get sample content randomly
const sampleTitles = Object.values(sampleEventsContent).flat().map(e => e.title);
const sampleDescriptions = Object.values(sampleEventsContent).flat().map(e => e.description);
const sampleImages = Object.values(sampleEventsContent).flat().map(e => e.imageUrl);
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Constants for edge detection
const EDGE_ZONE_WIDTH_PERCENTAGE = 0.25; // 25%
const EDGE_HOVER_DELAY_MS = 1500; // 1.5 seconds (Changed from 500)

const CalendarContainer = ({ currentDate, view, onDateChange }: CalendarContainerProps) => {
  // ...existing code...
  // isMobile is already defined

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [allEvents, setAllEvents] = useState<KanbanEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<KanbanEvent | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<KanbanEvent | null>(null);
  const [activeDroppableId, setActiveDroppableId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the main container
  const [edgeHoverState, setEdgeHoverState] = useState<'left' | 'right' | null>(null); // State for edge hover
  const edgeHoverTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for edge activation

  const effectiveView = isMobile ? "day" : view;

  // Generate dynamic mock events based on the initial date
  useEffect(() => {
    const generatedEvents: KanbanEvent[] = [];
    const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const initialWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const daysInInitialWeek = eachDayOfInterval({ start: initialWeekStart, end: initialWeekEnd });

    daysInInitialWeek.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const numEvents = Math.floor(Math.random() * 3) + 1; // 1 to 3 events per day

      for (let i = 0; i < numEvents; i++) {
        const startHour = 8 + Math.floor(Math.random() * 10); // 8 AM to 5 PM start times
        const eventStart = addHours(day, startHour);
        const eventTimeStr = format(eventStart, "hh:mm a");
        
        generatedEvents.push({
          id: `event-${dateStr}-${i}`,
          title: getRandomElement(sampleTitles),
          description: getRandomElement(sampleDescriptions),
          imageUrl: getRandomElement(sampleImages),
          time: eventTimeStr,
          date: dateStr,
        });
      }
    });
    setAllEvents(generatedEvents);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter events based on the *effective* view and date
  const filteredEvents = useMemo(() => {
    const currentViewDate = currentDate; // Use the main currentDate for filtering
    if (effectiveView === "day") {
      const dateStr = format(currentViewDate, "yyyy-MM-dd");
      return allEvents.filter(event => event.date === dateStr);
    } else { // effectiveView === "week"
      const weekStart = startOfWeek(currentViewDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentViewDate, { weekStartsOn: 1 });
      const weekDates = new Set(
        eachDayOfInterval({ start: weekStart, end: weekEnd })
        .map(d => format(d, "yyyy-MM-dd"))
      );
      return allEvents.filter(event => weekDates.has(event.date));
    }
  }, [allEvents, currentDate, effectiveView]);

  // Group events by date for week view rendering (only needed for desktop week view)
  const eventsByDateForWeek = useMemo(() => {
    if (effectiveView !== "week") return {};
    const grouped: { [date: string]: KanbanEvent[] } = {};
    filteredEvents.forEach(event => {
      if (!grouped[event.date]) { grouped[event.date] = []; }
      grouped[event.date].push(event);
    });
    return grouped;
  }, [filteredEvents, effectiveView]);

  // Initialize sensors unconditionally
  const pointerSensor = useSensor(PointerSensor, {
    // Require the mouse pointer to move by 5 pixels before activating on desktop
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    // Press delay of 250ms, with tolerance of 5px of movement for mobile
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(
    // Conditionally pass the initialized sensor instances
    isMobile ? touchSensor : pointerSensor,
    keyboardSensor
  );

  // Function to clear the edge hover timer and state
  const clearEdgeHover = useCallback(() => {
    if (edgeHoverTimerRef.current) {
      clearTimeout(edgeHoverTimerRef.current);
      edgeHoverTimerRef.current = null;
    }
    setEdgeHoverState(null);
  }, []);

  // --- Drag Handlers ---
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const eventToDrag = allEvents.find(e => e.id === active.id);
    if (eventToDrag) {
      setDraggedEvent(eventToDrag);
      setSelectedEvent(null);
    }
    setActiveDroppableId(null);
    setDragOverItemId(null);
    clearEdgeHover(); // Clear any previous edge state
    console.log("Drag Start:", active.id);
  };

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!isMobile || !draggedEvent || !containerRef.current || effectiveView !== 'day') { // Only for mobile day view
      clearEdgeHover(); // Clear if not applicable
      return;
    }

    // Use activatorEvent which might hold coordinates (more reliable than delta for position)
    // Note: This relies on the event being a PointerEvent or similar. Might need refinement based on testing.
    const pointerX = (event.activatorEvent as PointerEvent)?.clientX;

    if (pointerX === undefined) {
        // Fallback or skip if coordinates aren't available
        // This could happen with KeyboardSensor, etc.
        // console.warn("Could not get clientX from DragMoveEvent activatorEvent");
        // Don't clear hover state here, as the drag might still be active near an edge
        return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerLeft = containerRect.left;
    const containerWidth = containerRect.width;
    const edgeWidth = containerWidth * EDGE_ZONE_WIDTH_PERCENTAGE;

    // Adjust edge boundaries slightly inwards to avoid accidental system gesture triggers
    const safetyMargin = 10; // px
    const leftEdgeBoundary = containerLeft + edgeWidth + safetyMargin;
    const rightEdgeBoundary = containerLeft + containerWidth - edgeWidth - safetyMargin;

    let currentEdge: 'left' | 'right' | null = null;
    // Ensure check is within the container, not just outside screen edges if container is smaller
    if (pointerX >= containerLeft && pointerX < leftEdgeBoundary) {
        currentEdge = 'left';
    } else if (pointerX <= containerRect.right && pointerX > rightEdgeBoundary) {
        currentEdge = 'right';
    }

    // If the edge state hasn't changed, do nothing more
    if (currentEdge === edgeHoverState) {
        return;
    }

    // Clear existing timer if edge changes or moves out of zone
    // Keep existing edgeHoverState until timer clears or new edge detected
    if (edgeHoverTimerRef.current) {
         clearTimeout(edgeHoverTimerRef.current);
         edgeHoverTimerRef.current = null;
    }
    setEdgeHoverState(currentEdge); // Update visual state immediately

    if (currentEdge) {
        console.log(`Hovering ${currentEdge} edge`);
        edgeHoverTimerRef.current = setTimeout(() => {
            console.log(`Triggering day change: ${currentEdge}`);
            const newDate = currentEdge === 'left' ? subDays(currentDate, 1) : addDays(currentDate, 1);
            onDateChange(newDate);

             // Haptic feedback (optional, browser support varies)
            if (navigator.vibrate) {
                navigator.vibrate(50); // Short vibration
            }
            // Reset timer ref, but keep edgeHoverState for visual feedback until drag ends or moves
            edgeHoverTimerRef.current = null;
             // Set state again to ensure visual remains if needed, or maybe clear it?
             // Let's clear it after trigger to prevent re-trigger if user lingers
             // setEdgeHoverState(null); // Let dragEnd handle final clear
        }, EDGE_HOVER_DELAY_MS);
    }
  }, [isMobile, draggedEvent, edgeHoverState, clearEdgeHover, onDateChange, currentDate, effectiveView]);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    // Skip if no over target or same as active
    if (!over || active.id === over.id) {
      setDragOverItemId(null);
      return;
    }
    
    if (over.data.current?.type === 'droppable-day') {
      setActiveDroppableId(over.id as string);
      setDragOverItemId(null);
    } else {
      // This is an event item we're hovering over
      setDragOverItemId(over.id as string);
      
      // Find what day this event belongs to
      const overEvent = allEvents.find(e => e.id === over.id);
      if (overEvent) {
        setActiveDroppableId(overEvent.date);
      }
    }
    
    console.log("Drag Over:", over.id, "Type:", over.data.current?.type || "event");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    clearEdgeHover(); // Ensure timer/state is cleared on drag end
    const { active, over } = event;
    
    setDraggedEvent(null);
    setActiveDroppableId(null);
    setDragOverItemId(null);
    
    if (!over) {
      console.log("Drag End: No target");
      return;
    }

    console.log("Drag End:", active.id, "dropped on", over.id);

    if (over.data.current?.type === 'droppable-day') {
      // Case 1: Dropped on a day container
      const targetDate = over.id as string;
      const originalEvent = allEvents.find(e => e.id === active.id);

      if (originalEvent && originalEvent.date !== targetDate) {
        setAllEvents(prevEvents =>
          prevEvents.map(e =>
            e.id === active.id ? { ...e, date: targetDate } : e
          )
        );
        console.log(`Moved ${active.id} from ${originalEvent.date} to date ${targetDate}`);
      }
    } else if (over.id !== active.id) {
      // Case 2: Dropped on another event (for reordering)
      const activeEvent = allEvents.find(e => e.id === active.id);
      const overEvent = allEvents.find(e => e.id === over.id);
      
      if (activeEvent && overEvent) {
        // Handling both same-day reordering and cross-day movement
        const sourceDate = activeEvent.date;
        const targetDate = overEvent.date;
        
        if (sourceDate === targetDate) {
          // Same-day reorder by moving within the full events array
          setAllEvents(prevEvents => {
            const oldGlobalIndex = prevEvents.findIndex(e => e.id === active.id);
            const newGlobalIndex = prevEvents.findIndex(e => e.id === over.id);
            if (oldGlobalIndex === -1 || newGlobalIndex === -1) return prevEvents;
            return arrayMove(prevEvents, oldGlobalIndex, newGlobalIndex);
          });
          console.log(`Reordered ${active.id} within day ${sourceDate}`);
        } else {
          // Moving to another day at a specific position
          // First, remove from source day
          setAllEvents(prevEvents => {
            const updatedEvent = { ...activeEvent, date: targetDate };
            const withoutActive = prevEvents.filter(e => e.id !== active.id);
            
            // Insert at the right position in the target day
            const targetDateEvents = withoutActive.filter(e => e.date === targetDate);
            const insertAtIndex = targetDateEvents.findIndex(e => e.id === over.id);
            
            // If not found, just append to the other day's events
            if (insertAtIndex === -1) {
              return [...withoutActive, updatedEvent];
            }
            
            // Otherwise insert at the right position
            const beforeInsert = targetDateEvents.slice(0, insertAtIndex);
            const afterInsert = targetDateEvents.slice(insertAtIndex);
            const otherEvents = withoutActive.filter(e => e.date !== targetDate);
            
            return [
              ...otherEvents,
              ...beforeInsert,
              updatedEvent,
              ...afterInsert
            ];
          });
          console.log(`Moved ${active.id} from ${sourceDate} to ${targetDate} at position after ${over.id}`);
        }
      }
    }
  };

  const handleDragCancel = useCallback(() => {
      clearEdgeHover();
      setDraggedEvent(null);
      setActiveDroppableId(null);
      setDragOverItemId(null);
      console.log("Drag Cancelled");
  }, [clearEdgeHover]);

  // --- Mobile Swipe Navigation ---
  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (draggedEvent) return; 
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
  };

  const handleDragEndSwipe = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (draggedEvent) return;
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;

    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      onDateChange(subDays(currentDate, 1));
    } else if (info.offset.x < -swipeThreshold) {
      onDateChange(addDays(currentDate, 1));
    }
  };
  // --- End Mobile Swipe ---

  const handleEventClick = (event: KanbanEvent) => {
    if (draggedEvent) return;
    setSelectedEvent(event);
  };

  const handleEventClose = () => {
    setSelectedEvent(null);
  };

  const handleEventEdit = (event: KanbanEvent) => {
    console.log("Edit Event:", event);
    handleEventClose();
  };

  const handleEventDelete = (eventId: string) => {
    setAllEvents(allEvents.filter((event) => event.id !== eventId));
    handleEventClose();
  };

  // --- Render Logic ---
  const renderDayViewContent = () => {
    const dayEvents = allEvents.filter(event => event.date === format(currentDate, "yyyy-MM-dd"));
    const dragDate = format(currentDate, "yyyy-MM-dd");
    // Peek effect: true if edgeHoverState is set and a card is being dragged
    const isPeeking = Boolean(isMobile && draggedEvent && edgeHoverState);
    return (
      <SortableContext items={dayEvents.map(e => e.id)} strategy={verticalListSortingStrategy}>
        {/* Edge peek overlays for mobile edge drag */}
        {isMobile && draggedEvent && (
  <>
    {/* Highlight edge zones for mobile edge drag */}
    <div className="absolute top-0 left-0 h-full w-1/4 z-40 pointer-events-none bg-green-300/40 rounded-l-astral animate-pulse" />
    <div className="absolute top-0 right-0 h-full w-1/4 z-40 pointer-events-none bg-yellow-300/40 rounded-r-astral animate-pulse" />

    {/* Existing animated edge indicators for feedback */}
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{
        opacity: edgeHoverState === 'left' ? 1 : 0,
        x: edgeHoverState === 'left' ? 0 : -30
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 left-0 h-full w-6 z-50 pointer-events-none"
      style={{ background: 'linear-gradient(90deg, #3b66ff22 80%, transparent)' }}
    />
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{
        opacity: edgeHoverState === 'right' ? 1 : 0,
        x: edgeHoverState === 'right' ? 0 : 30
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 h-full w-6 z-50 pointer-events-none"
      style={{ background: 'linear-gradient(270deg, #3b66ff22 80%, transparent)' }}
    />
  </>
)}
        <motion.div
          className={cn(
            "p-4 space-y-0 overflow-y-auto h-full relative",
            activeDroppableId === dragDate && "bg-blue-50/50 transition-colors duration-150"
          )}
          style={{ touchAction: 'pan-y' }}
          animate={isPeeking ? {
            x: edgeHoverState === 'left' ? 20 : edgeHoverState === 'right' ? -20 : 0
          } : { x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {dayEvents.length === 0 ? (
            <p className="text-center text-slate-500 pt-10">No events scheduled.</p>
          ) : (
            dayEvents.map(event => (
              <EventCard 
                key={event.id} 
                event={event} 
                onClick={handleEventClick} 
              />
            ))
          )}
          {draggedEvent && dayEvents.length === 0 && activeDroppableId === dragDate && (
            <div className="h-28 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50 flex items-center justify-center mt-2">
              <p className="text-blue-500 text-sm">Drop to add to this day</p>
            </div>
          )}
        </motion.div>
      </SortableContext>
    );
  };

  const renderWeekViewContent = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

    return (
      <div className="grid grid-cols-7 h-[90vh] border-t border-l border-slate-200">
        {weekDays.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDateForWeek[dateStr] || [];
          const isToday = isSameDay(day, new Date());
          const isDroppableOver = activeDroppableId === dateStr;

          return (
             <DroppableDay key={dateStr} id={dateStr} isOver={isDroppableOver}>
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
                <div className={cn(
                  "p-1 overflow-y-auto space-y-0 bg-white max-h-[85vh]",
                  isDroppableOver && "bg-blue-50/50 transition-colors duration-150"
                )}>
                    <SortableContext items={dayEvents.map(e=>e.id)} strategy={verticalListSortingStrategy}>
                        {dayEvents.map(event => (
                          <EventCard key={event.id} event={event} onClick={handleEventClick} />
                        ))}
                        {/* Empty state with drop indicator */}
                        {dayEvents.length === 0 && (
                          <div className={cn(
                            "text-center text-xs text-slate-400 h-full min-h-[100px] flex items-center justify-center",
                            draggedEvent && "border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50 py-4"
                          )}>
                            {draggedEvent && <p className="text-blue-500">Drop here</p>}
                          </div>
                        )}
                    </SortableContext>
                </div>
             </DroppableDay>
          );
        })}
      </div>
    );
  };

  return (
    <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter}
        onDragStart={handleDragStart} 
        onDragMove={handleDragMove}
        onDragOver={handleDragOver} 
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
    >
      <div
  ref={containerRef}
  className={cn(
    "bg-white rounded-b-astral shadow-sm border border-slate-100 border-t-0 flex-1 flex flex-col relative",
    isMobile && "border-4 border-red-500 min-h-[calc(100dvh-56px)] h-[calc(100dvh-56px)] overflow-y-auto"
  )}
>
        <AnimatePresence mode="wait">
          <motion.div
            key={effectiveView === 'week' ? `week-${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}` : `day-${format(currentDate, 'yyyy-MM-dd')}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.20 }}
            className="h-full"
            drag={isMobile && !draggedEvent && effectiveView === 'day' ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }} 
            dragElastic={0.1} 
            onDrag={handleDrag} 
          >
            {effectiveView === 'week' ? renderWeekViewContent() : renderDayViewContent()}
          </motion.div>
        </AnimatePresence>
        {/* DragOverlay: ensure the card stays attached visually during edge-traversal */}
        <DragOverlay dropAnimation={null}>
          {draggedEvent && (
            <div className="pointer-events-none z-50">
              <EventCard event={draggedEvent} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default CalendarContainer; 