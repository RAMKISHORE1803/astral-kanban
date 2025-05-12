"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addHours, addDays, subDays, parse } from "date-fns";
import sampleEventsContent from "@/app/lib/eventData";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import { cn } from "@/app/lib/utils";
import CalendarDayView from "./views/CalendarDayView";
import CalendarWeekView from "./views/CalendarWeekView";
import { flushSync } from "react-dom";
import EventDetailModal from "./EventDetailModal";
import type { KanbanEvent, ModalData, CustomDragState, DebugInfo, CalendarContainerProps } from "@/app/types/calendar";
import { EDGE_ZONE_WIDTH_PERCENTAGE, TRANSITION_COOLDOWN, EDGE_HOLD_DURATION } from "@/app/lib/constants";
import { AnimatePresence, motion } from "framer-motion";

const sampleTitles = Object.values(sampleEventsContent).flat().map(e => e.title);
const sampleDescriptions = Object.values(sampleEventsContent).flat().map(e => e.description);
const sampleImages = Object.values(sampleEventsContent).flat().map(e => e.imageUrl);
const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const sortEventsByTime = (events: KanbanEvent[]): KanbanEvent[] => {
  return [...events].sort((a, b) => {
    try {
      const timeA = parse(a.time, 'hh:mm a', new Date());
      const timeB = parse(b.time, 'hh:mm a', new Date());
      return timeA.getTime() - timeB.getTime();
    } catch (e) {
      return a.time.localeCompare(b.time);
    }
  });
};

let globalDragTracking = {
  activeOverlay: null as HTMLDivElement | null,
  isTracking: false,
  currentPosition: { x: 0, y: 0 },
  animationFrame: null as number | null,
  offsetX: 0,
  offsetY: 0,
  targetElement: null as HTMLElement | null,
  synchronizingWithReact: false,
  dropPending: false,
  lastDetectedColumn: null as string | null,
  inTransition: false,
  edgeDetectionEnabled: true,
  edgeHoldTimer: null as NodeJS.Timeout | null,
  isInEdgeZone: false,
  dragInitiated: false,
  dragThreshold: 5,
  initialPosition: { x: 0, y: 0 },
  inDesktopWeekView: false,
  dropZoneElement: null as HTMLElement | null,
  cursorOverlayPosition: { x: 0, y: 0 },
};

function updateGlobalOverlayPosition() {
  if (!globalDragTracking.activeOverlay || !globalDragTracking.isTracking) return;
  
  const { x, y } = globalDragTracking.currentPosition;
  
  if (globalDragTracking.activeOverlay) {
    const cardElement = globalDragTracking.activeOverlay.querySelector('div');
    if (cardElement) {
      const posX = x - globalDragTracking.cursorOverlayPosition.x;
      const posY = y - globalDragTracking.cursorOverlayPosition.y;
      
      globalDragTracking.activeOverlay.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
    }
  }

  if (globalDragTracking.isTracking && !globalDragTracking.inTransition) {
    const elementsAtPoint = document.elementsFromPoint(x, y);
    const columnElement = elementsAtPoint.find(el => 
      el.hasAttribute('data-date') || el.closest('[data-date]')
    );
    
    if (columnElement) {
      const dateAttr = columnElement.getAttribute('data-date') || 
                       columnElement.closest('[data-date]')?.getAttribute('data-date');
      if (dateAttr) {
        globalDragTracking.lastDetectedColumn = dateAttr;
        globalDragTracking.dropZoneElement = (columnElement.closest('[data-date]') as HTMLElement) || (columnElement as HTMLElement);
      }
    }
  }

  if (globalDragTracking.isTracking && 
      !globalDragTracking.inTransition && 
      globalDragTracking.edgeDetectionEnabled) {
    const container = document.querySelector('.calendar-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
      
      const atLeftEdge = x < containerRect.left + edgeWidth;
      const atRightEdge = x > containerRect.right - edgeWidth;
      const currentlyAtEdge = atLeftEdge || atRightEdge;
      const edgeDirection = atLeftEdge ? 'left' : (atRightEdge ? 'right' : null);

      if (currentlyAtEdge && !globalDragTracking.isInEdgeZone && !globalDragTracking.edgeHoldTimer) {
        globalDragTracking.isInEdgeZone = true;
        
        globalDragTracking.edgeHoldTimer = setTimeout(() => {
          const currentX = globalDragTracking.currentPosition.x;
          const container = document.querySelector('.calendar-container');
          if (container) {
              const containerRectNow = container.getBoundingClientRect();
              const edgeWidthNow = containerRectNow.width * EDGE_ZONE_WIDTH_PERCENTAGE;
              const stillAtLeft = currentX < containerRectNow.left + edgeWidthNow;
              const stillAtRight = currentX > containerRectNow.right - edgeWidthNow;
              const finalEdgeDirection = stillAtLeft ? 'left' : (stillAtRight ? 'right' : null);

              if (finalEdgeDirection) {
                 document.dispatchEvent(new CustomEvent('edgeDetected', { 
                    detail: { edge: finalEdgeDirection } 
                 }));
              }
          }
          
          globalDragTracking.edgeHoldTimer = null;
          globalDragTracking.isInEdgeZone = false; 

        }, EDGE_HOLD_DURATION);
      }
      else if (!currentlyAtEdge && globalDragTracking.isInEdgeZone) {
        globalDragTracking.isInEdgeZone = false;
      }
    }
  }

  globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
}

function snapToPosition(targetX: number, targetY: number, onComplete: () => void) {
  if (!globalDragTracking.activeOverlay) return onComplete();
  
  const cardElement = globalDragTracking.activeOverlay.querySelector('div');
  if (!cardElement) return onComplete();
  
  const cardWidth = cardElement.offsetWidth;
  const cardHeight = cardElement.offsetHeight;
  
  const style = window.getComputedStyle(globalDragTracking.activeOverlay);
  const matrix = new DOMMatrix(style.transform);
  const startX = matrix.m41;
  const startY = matrix.m42;
  
  const startTime = performance.now();
  const duration = 300;
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easing = (t: number) => {
      return t < 0.5
        ? 4 * t * t * t
        : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    };
    
    const easedProgress = easing(progress);
    
    const currentX = startX + (targetX - startX) * easedProgress;
    const currentY = startY + (targetY - startY) * easedProgress;
    
    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (globalDragTracking.activeOverlay) {
        globalDragTracking.activeOverlay.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      onComplete();
    }
  };
  
  globalDragTracking.activeOverlay.style.transition = 'none';
  requestAnimationFrame(animate);
}

interface CalendarContainerWithDirectionProps extends CalendarContainerProps {
  animationDirection?: 'left' | 'right';
}

const CalendarContainer = ({ currentDate, view, onDateChange, animationDirection = 'right' }: CalendarContainerProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [allEvents, setAllEvents] = useState<KanbanEvent[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [modalData, setModalData] = useState<ModalData | null>(null);
  
  const [customDragState, setCustomDragState] = useState<CustomDragState>({
    isDragging: false,
    event: null,
    position: null,
    startedOn: null,
    currentlyHovering: null,
    dropTargetId: null,
    dragStartTime: null
  });
  
  const edgeTransitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const dayOffsetRef = useRef(0);
  
  const isTransitioningRef = useRef(false);
    
  const lastTransitionTimeRef = useRef(0);
  
  const triggerDateChangeRef = useRef<(direction: 'left' | 'right') => void>();
  const finalizeCustomDragRef = useRef<() => void>();
  const reactSyncRef = useRef({
    lastStateUpdate: 0,
    targetDateAfterTransition: null as string | null,
    dropRequested: false,
    pendingUpdate: false
  });
  const prevDateAnimRef = useRef<{ date: Date | null, direction: 'left' | 'right' | null }>({ date: null, direction: 'right' });

  const edgeHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const edgeHoverDirectionRef = useRef<'left' | 'right' | null>(null);

  const mouseStateRef = useRef({
    mouseDownEvent: null as MouseEvent | null,
    originalTargetRect: null as DOMRect | null,
    originalEvent: null as KanbanEvent | null,
    dragThresholdMet: false,
    dragStarted: false,
    mouseDownTarget: null as HTMLElement | null,
  });

  const effectiveView = isMobile ? "day" : view;

  useEffect(() => {
    globalDragTracking.inDesktopWeekView = !isMobile && view === "week";
  }, [isMobile, view]);

  const getNavigationOffset = useCallback((direction: 'left' | 'right') => {
    if (isMobile || view === "day") {
      return direction === 'left' ? -1 : 1;
    } else {
      return direction === 'left' ? -7 : 7;
    }
  }, [isMobile, view]);

  const filteredEvents = useMemo(() => {
    if (effectiveView === "day") {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const dayEvents = allEvents.filter(event => event.date === dateStr);
      return sortEventsByTime(dayEvents);
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const weekDates = new Set(
        eachDayOfInterval({ start: weekStart, end: weekEnd })
        .map(d => format(d, "yyyy-MM-dd"))
      );
      return allEvents.filter(event => weekDates.has(event.date));
    }
  }, [allEvents, currentDate, effectiveView]);

  const eventsByDateForWeek = useMemo(() => {
    if (effectiveView !== "week") return {};
    
    const grouped: { [date: string]: KanbanEvent[] } = {};
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    
    eachDayOfInterval({ start: weekStart, end: weekEnd }).forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      grouped[dateStr] = [];
    });
    
    filteredEvents.forEach(event => {
      if (!grouped[event.date]) { 
        grouped[event.date] = []; 
      }
      grouped[event.date].push(event);
    });
    
    Object.keys(grouped).forEach(date => {
      grouped[date] = sortEventsByTime(grouped[date]);
    });
    
    return grouped;
  }, [filteredEvents, currentDate, effectiveView]);

  const finalizeCustomDrag = useCallback(() => {
    if (!customDragState.isDragging || !customDragState.event) {
      return;
    }
    
    if (globalDragTracking.inTransition || isTransitioningRef.current) {
      globalDragTracking.dropPending = true;
      
      setTimeout(() => {
        if (globalDragTracking.dropPending) {
          finalizeCustomDrag(); 
        }
      }, 150);
      return;
    }
    
    globalDragTracking.isTracking = false;
    globalDragTracking.dropPending = false;
    globalDragTracking.dragInitiated = false;
    
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }
    
    const currentDateStr = format(currentDate, "yyyy-MM-dd");
    let targetDateStr = currentDateStr;
    
    if (globalDragTracking.lastDetectedColumn) {
      targetDateStr = globalDragTracking.lastDetectedColumn;
    }
    
    const droppedEvent = customDragState.event;
    
    globalDragTracking.synchronizingWithReact = true;
    reactSyncRef.current.lastStateUpdate = Date.now();
    
    if (navigator.vibrate) navigator.vibrate([15, 10, 40]);
    
    flushSync(() => {
      const eventsWithoutDragged = allEvents.filter(e => e.id !== droppedEvent.id);
      const updatedEvent = { ...droppedEvent, date: targetDateStr };
      
      const newEvents = [...eventsWithoutDragged, updatedEvent];
      setAllEvents(newEvents);
      
      setCustomDragState({
        isDragging: false, 
        event: null, 
        position: null, 
        startedOn: null, 
        currentlyHovering: null, 
        dropTargetId: null,
        dragStartTime: null
      });
    });
    
    requestAnimationFrame(() => {
      const newCardElement = document.querySelector(`[data-event-id="${droppedEvent.id}"]`);
      
      if (newCardElement && globalDragTracking.activeOverlay) {
        const targetRect = newCardElement.getBoundingClientRect();
        snapToPosition(targetRect.left, targetRect.top, () => {
          if (globalDragTracking.activeOverlay) {
            globalDragTracking.activeOverlay.style.display = 'none';
          }
          if (navigator.vibrate) navigator.vibrate(25);
          globalDragTracking.synchronizingWithReact = false;
        });
        newCardElement.classList.add('pulse-highlight');
        setTimeout(() => { newCardElement.classList.remove('pulse-highlight'); }, 500);
      } else {
        if (globalDragTracking.activeOverlay) {
          globalDragTracking.activeOverlay.style.transition = 'opacity 0.3s ease';
          globalDragTracking.activeOverlay.style.opacity = '0';
          setTimeout(() => {
            if (globalDragTracking.activeOverlay) {
              globalDragTracking.activeOverlay.style.display = 'none';
              globalDragTracking.activeOverlay.style.transition = '';
              globalDragTracking.activeOverlay.style.opacity = '1';
            }
            globalDragTracking.synchronizingWithReact = false;
          }, 300);
        }
      }
      
      isTransitioningRef.current = false;
      globalDragTracking.inTransition = false;
      if (edgeTransitionTimerRef.current) {
        clearTimeout(edgeTransitionTimerRef.current);
        edgeTransitionTimerRef.current = null;
      }
      document.body.style.overflow = '';
      document.body.classList.remove('calendar-dragging');
    });

  }, [customDragState, currentDate, allEvents]);
  
  const triggerDateChange = useCallback((direction: 'left' | 'right') => {
    if (isTransitioningRef.current || globalDragTracking.inTransition) {
      console.log(`[CalendarContainer] Ignoring triggerDateChange (${direction}): already in transition`);
      return;
    }
    
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < TRANSITION_COOLDOWN) {
      console.log(`[CalendarContainer] Ignoring triggerDateChange (${direction}): cooldown period`);
      return;
    }
    
    console.log(`[CalendarContainer] Executing triggerDateChange: ${direction}, view: ${view}`);
    
    isTransitioningRef.current = true;
    globalDragTracking.inTransition = true;
    lastTransitionTimeRef.current = now;
    globalDragTracking.edgeDetectionEnabled = false;
    
    document.body.classList.add('transitioning-day');
    
    if (edgeHoldTimerRef.current) {
      clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
    }
    edgeHoverDirectionRef.current = null;

    if (customDragState.isDragging && globalDragTracking.activeOverlay) {
      const cardElement = globalDragTracking.activeOverlay.querySelector('div');
      if (cardElement) {
        cardElement.classList.add('pulse-outline');
        cardElement.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.25)';
      }
    }
    
    const dayOffset = getNavigationOffset(direction);
    
    const newDate = addDays(currentDate, dayOffset);
    const newDateStr = format(newDate, "yyyy-MM-dd");
    
    reactSyncRef.current.targetDateAfterTransition = newDateStr;
    globalDragTracking.lastDetectedColumn = newDateStr;
    dayOffsetRef.current += direction === 'left' ? -1 : 1;
    
    if (navigator.vibrate) navigator.vibrate([30, 20, 50]);
    
    if (customDragState.isDragging && customDragState.event) {
      const updatedEvent = { ...customDragState.event, date: newDateStr };
      globalDragTracking.synchronizingWithReact = true;
      reactSyncRef.current.lastStateUpdate = Date.now();
      setCustomDragState(prev => ({ ...prev, event: updatedEvent, currentlyHovering: null, dropTargetId: null }));
    }
    
    prevDateAnimRef.current = {
      date: currentDate,
      direction: animationDirection
    };
    onDateChange(newDate, direction);
    
    setTimeout(() => {
      if (globalDragTracking.activeOverlay) {
        const cardElement = globalDragTracking.activeOverlay.querySelector('div');
        if (cardElement) {
          cardElement.classList.remove('pulse-outline');
          cardElement.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
        }
      }
      isTransitioningRef.current = false;
      globalDragTracking.inTransition = false;
      globalDragTracking.synchronizingWithReact = false;
      
      document.body.classList.remove('transitioning-day');

      if (navigator.vibrate) navigator.vibrate(20);

      if (globalDragTracking.dropPending) {
        finalizeCustomDrag();
        return;
      }
      
      setTimeout(() => {
        console.log('[CalendarContainer] Re-enabling edge detection after transition');
        globalDragTracking.edgeDetectionEnabled = true;
        edgeHoverDirectionRef.current = null;
        if (edgeHoldTimerRef.current) {
           clearTimeout(edgeHoldTimerRef.current);
           edgeHoldTimerRef.current = null;
        } 
      }, TRANSITION_COOLDOWN);
      
    }, 350);
  }, [customDragState, currentDate, onDateChange, finalizeCustomDrag, animationDirection, getNavigationOffset]);

  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number, targetElement?: HTMLElement) => {
    if (customDragState.isDragging) {
      return;
    }
    
    globalDragTracking.dragInitiated = true;
    globalDragTracking.isTracking = true;
    globalDragTracking.currentPosition = { x: clientX, y: clientY };
    globalDragTracking.initialPosition = { x: clientX, y: clientY };
    
    reactSyncRef.current.targetDateAfterTransition = null;
    
    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.innerHTML = '';
      const eventCardHtml = `
        <div class="bg-white rounded-lg border border-slate-200 shadow-lg p-3" style="width: auto; max-width: 320px; transform: scale(1.05); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25); will-change: transform; backface-visibility: hidden; touch-action: none;">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-medium text-slate-800">${event.title}</h3>
            <span class="text-xs text-slate-500">${event.time}</span>
          </div>
          ${event.imageUrl ? 
            `<div class="mb-2 rounded overflow-hidden h-20 bg-slate-100">
              <img src="${event.imageUrl}" alt="" class="w-full h-full object-cover">
            </div>` : ''}
          ${event.description ? 
            `<p class="text-sm text-slate-600 line-clamp-2">${event.description}</p>` : ''}
        </div>
      `;
      globalDragTracking.activeOverlay.innerHTML = eventCardHtml;
      globalDragTracking.activeOverlay.style.display = 'block';
      
      const originalCard = targetElement || document.querySelector(`[data-event-id="${event.id}"]`);
      
      if (originalCard) {
        const originalRect = originalCard.getBoundingClientRect();
        globalDragTracking.targetElement = originalCard as HTMLElement;
        
        const cursorOffsetX = clientX - originalRect.left;
        const cursorOffsetY = clientY - originalRect.top;
        
        globalDragTracking.cursorOverlayPosition = { x: cursorOffsetX, y: cursorOffsetY };
        
        globalDragTracking.activeOverlay.style.transform = `translate3d(${originalRect.left}px, ${originalRect.top}px, 0)`;
        globalDragTracking.activeOverlay.style.transition = 'none';
        
        setTimeout(() => {
          if (globalDragTracking.activeOverlay) {
            const posX = clientX - cursorOffsetX;
            const posY = clientY - cursorOffsetY;
            
            globalDragTracking.activeOverlay.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
            
            if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
            globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
          }
        }, 0);
      } else {
        const cardElement = globalDragTracking.activeOverlay?.querySelector('div');
        if (cardElement) {
          const cardWidth = cardElement.offsetWidth;
          const cardHeight = cardElement.offsetHeight;
          
          globalDragTracking.cursorOverlayPosition = { 
            x: cardWidth / 2, 
            y: cardHeight / 2 
          };
          
          globalDragTracking.activeOverlay.style.transform = `translate3d(${clientX - (cardWidth / 2)}px, ${clientY - (cardHeight / 2)}px, 0)`;
        }
        if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
        globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
      }
      
      if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
    }
    
    setCustomDragState({
      isDragging: true, 
      event: event, 
      position: { x: clientX, y: clientY }, 
      startedOn: event.date, 
      currentlyHovering: null, 
      dropTargetId: null,
      dragStartTime: Date.now()
    });
    
    document.body.style.overflow = 'hidden';
    document.body.classList.add('calendar-dragging');
  }, []);

  const handleEventMouseDown = useCallback((event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      e.stopPropagation();
      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      startCustomDrag(event, clientX, clientY, e.currentTarget as HTMLElement);
    } else {
      e.preventDefault();
      e.stopPropagation();
      
      const mouseEvent = e.nativeEvent as MouseEvent;
      mouseStateRef.current = {
        mouseDownEvent: mouseEvent,
        originalTargetRect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
        mouseDownTarget: e.currentTarget as HTMLElement,
        originalEvent: event,
        dragThresholdMet: false,
        dragStarted: false
      };
    }
  }, [startCustomDrag]);

  const handleEventCardClick = useCallback((event: KanbanEvent, cardElement: HTMLElement) => {
    if (customDragState.isDragging) return;
    
    if (mouseStateRef.current.dragThresholdMet) return;
    
    const rect = cardElement.getBoundingClientRect();
    setModalData({ 
      event: event, 
      originRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scrollY: window.scrollY }
    });
    document.body.style.overflow = 'hidden'; 
  }, [customDragState.isDragging]);

  const closeDetailView = useCallback(() => {
    setModalData(null);
    document.body.style.overflow = ''; 
  }, []);

  const handleEventClick = useCallback((event: KanbanEvent, cardElement?: HTMLElement) => {
     if (customDragState.isDragging) return;
     
     if (mouseStateRef.current.dragThresholdMet) return;
     
     let element = cardElement;
     if (!element) {
       element = document.querySelector(`[data-event-id="${event.id}"]`) as HTMLElement;
     }
     if (element) {
       handleEventCardClick(event, element);
     } else {
       console.error('Event card element not found. Cannot open detail view.'); 
     }
  }, [customDragState.isDragging, handleEventCardClick]);
  
  const cancelCustomDrag = useCallback(() => {
    if (!customDragState.isDragging) return;
    
    globalDragTracking.isTracking = false;
    globalDragTracking.dragInitiated = false;
    
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }

    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.style.transition = 'opacity 0.2s ease';
      globalDragTracking.activeOverlay.style.opacity = '0';
      setTimeout(() => {
        if (globalDragTracking.activeOverlay) {
          globalDragTracking.activeOverlay.style.display = 'none';
          globalDragTracking.activeOverlay.style.opacity = '1';
          globalDragTracking.activeOverlay.style.transition = '';
        }
      }, 200);
    }
    
    setCustomDragState({ 
      isDragging: false, 
      event: null, 
      position: null, 
      startedOn: null, 
      currentlyHovering: null, 
      dropTargetId: null,
      dragStartTime: null
    });
    
    mouseStateRef.current = {
      mouseDownEvent: null,
      originalTargetRect: null,
      originalEvent: null,
      dragThresholdMet: false,
      dragStarted: false,
      mouseDownTarget: null,
    };
    
    globalDragTracking.inTransition = false;
    globalDragTracking.dropPending = false;
    globalDragTracking.edgeDetectionEnabled = true;
    
    if (edgeTransitionTimerRef.current) {
      clearTimeout(edgeTransitionTimerRef.current);
      edgeTransitionTimerRef.current = null;
    }
    
    document.body.style.overflow = '';
    document.body.classList.remove('calendar-dragging');
    
    if (edgeHoldTimerRef.current) {
      clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
    }
    edgeHoverDirectionRef.current = null;
    globalDragTracking.isInEdgeZone = false;
  }, [customDragState.isDragging]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && customDragState.isDragging) {
        cancelCustomDrag();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelCustomDrag, customDragState.isDragging]);


  useEffect(() => {
    const createOverlay = () => {
      if (globalDragTracking.activeOverlay) {
        try { document.body.removeChild(globalDragTracking.activeOverlay); } catch (e) {}
      }
      if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
      const overlayDiv = document.createElement('div');
      overlayDiv.id = 'global-drag-overlay';
      Object.assign(overlayDiv.style, { 
        position: 'fixed', 
        pointerEvents: 'none', 
        zIndex: '9999', 
        top: '0', 
        left: '0', 
        display: 'none', 
        transformOrigin: 'center center', 
        willChange: 'transform', 
        backfaceVisibility: 'hidden',
        transition: 'none',
        touchAction: 'none'
      });
      overlayDiv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlayDiv);
      globalDragTracking.activeOverlay = overlayDiv;
      globalDragTracking.isTracking = false;
    };
    createOverlay();
    
    const globalPointerMove = (e: PointerEvent) => {
      if (globalDragTracking.isTracking) {
        globalDragTracking.currentPosition = { x: e.clientX, y: e.clientY };
        if (!globalDragTracking.animationFrame) {
          globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
        }
      }
    };
    
    document.addEventListener('pointermove', globalPointerMove, { passive: true });
    
    return () => {
      document.removeEventListener('pointermove', globalPointerMove);
      if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
      if (globalDragTracking.activeOverlay) {
        try { document.body.removeChild(globalDragTracking.activeOverlay); } catch (e) {}
        globalDragTracking.activeOverlay = null;
      }
      globalDragTracking.isTracking = false;
    };
  }, []);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseStateRef.current.mouseDownEvent || mouseStateRef.current.dragStarted) return;
      
      const initialX = mouseStateRef.current.mouseDownEvent.clientX;
      const initialY = mouseStateRef.current.mouseDownEvent.clientY;
      const deltaX = e.clientX - initialX;
      const deltaY = e.clientY - initialY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      if (distance >= globalDragTracking.dragThreshold) {
        mouseStateRef.current.dragThresholdMet = true;
        
        if (!mouseStateRef.current.dragStarted && mouseStateRef.current.originalEvent && mouseStateRef.current.mouseDownTarget) {
          mouseStateRef.current.dragStarted = true;
          
          startCustomDrag(
            mouseStateRef.current.originalEvent, 
            e.clientX, 
            e.clientY,
            mouseStateRef.current.mouseDownTarget
          );
        }
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (mouseStateRef.current.dragThresholdMet && customDragState.isDragging) {
        finalizeCustomDrag();
      }
      
      mouseStateRef.current = {
        mouseDownEvent: null,
        originalTargetRect: null,
        originalEvent: null,
        dragThresholdMet: false,
        dragStarted: false,
        mouseDownTarget: null,
      };
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      if (!customDragState.isDragging) {
        mouseStateRef.current = {
          mouseDownEvent: null,
          originalTargetRect: null,
          originalEvent: null,
          dragThresholdMet: false,
          dragStarted: false,
          mouseDownTarget: null,
        };
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [customDragState.isDragging, finalizeCustomDrag, startCustomDrag]);
  
  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      globalDragTracking.currentPosition = { x: e.clientX, y: e.clientY };
      
      setCustomDragState(prev => ({ ...prev, position: { x: e.clientX, y: e.clientY } }));
      
      if (globalDragTracking.activeOverlay) {
        const cardElement = globalDragTracking.activeOverlay.querySelector('div');
        if (cardElement) {
          const posX = e.clientX - globalDragTracking.cursorOverlayPosition.x;
          const posY = e.clientY - globalDragTracking.cursorOverlayPosition.y;
          
          globalDragTracking.activeOverlay.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
        }
      }
      
      if (!isTransitioningRef.current && !globalDragTracking.inTransition && 
          globalDragTracking.edgeDetectionEnabled && effectiveView === 'day') {
        const container = document.querySelector('.calendar-container');
        const containerRect = container ? container.getBoundingClientRect() : containerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
          const leftEdgeBoundary = containerRect.left + edgeWidth;
          const rightEdgeBoundary = containerRect.right - edgeWidth;
          let currentEdge: 'left' | 'right' | null = null;
          if (e.clientX < leftEdgeBoundary) currentEdge = 'left';
          else if (e.clientX > rightEdgeBoundary) currentEdge = 'right';
          
          if (currentEdge !== customDragState.currentlyHovering) {
            setCustomDragState(prev => ({ ...prev, currentlyHovering: currentEdge }));
          }

          if (currentEdge !== edgeHoverDirectionRef.current) {
            if (edgeHoldTimerRef.current) {
              clearTimeout(edgeHoldTimerRef.current);
              edgeHoldTimerRef.current = null;
            }
            
            edgeHoverDirectionRef.current = currentEdge;

            if (currentEdge) {
              edgeHoldTimerRef.current = setTimeout(() => {
                const currentTrackedEdge = edgeHoverDirectionRef.current;
                
                if (!isTransitioningRef.current && !globalDragTracking.inTransition && globalDragTracking.edgeDetectionEnabled) {
                  const currentX = globalDragTracking.currentPosition.x;
                  const container = document.querySelector('.calendar-container');
                  if (container) {
                    const containerRectNow = container.getBoundingClientRect();
                    const edgeWidthNow = containerRectNow.width * EDGE_ZONE_WIDTH_PERCENTAGE;
                    const stillAtLeft = currentX < containerRectNow.left + edgeWidthNow;
                    const stillAtRight = currentX > containerRectNow.right - edgeWidthNow;
                    const finalEdgeDirection = stillAtLeft ? 'left' : (stillAtRight ? 'right' : null);

                    if (finalEdgeDirection === currentTrackedEdge) {
                      if (triggerDateChangeRef.current && currentTrackedEdge) {
                        triggerDateChangeRef.current(currentTrackedEdge);
                      }
                    }
                  }
                }
                edgeHoldTimerRef.current = null;
              }, EDGE_HOLD_DURATION);
            }
          }
        }
      }
    };
    
    const handlePointerEnd = (e: PointerEvent) => {
      if (edgeHoldTimerRef.current) {
        clearTimeout(edgeHoldTimerRef.current);
        edgeHoldTimerRef.current = null;
      }
      edgeHoverDirectionRef.current = null;
      
      if (!globalDragTracking.isTracking) return;
      if (isTransitioningRef.current || globalDragTracking.inTransition) {
        globalDragTracking.dropPending = true;
        return;
      }
      
      if (e.pointerType === 'touch') {
        if (finalizeCustomDragRef.current) {
          finalizeCustomDragRef.current(); 
        }
      }
    };
    
    document.addEventListener('pointermove', handlePointerMove, { capture: true });
    document.addEventListener('pointerup', handlePointerEnd, { capture: true });
    document.addEventListener('pointercancel', handlePointerEnd, { capture: true });
    document.body.style.userSelect = 'none';
    
    return () => {
      document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      document.removeEventListener('pointerup', handlePointerEnd, { capture: true });
      document.removeEventListener('pointercancel', handlePointerEnd, { capture: true });
      document.body.style.userSelect = '';
      if (edgeHoldTimerRef.current) {
        clearTimeout(edgeHoldTimerRef.current);
        edgeHoldTimerRef.current = null;
      }
      edgeHoverDirectionRef.current = null;
    };
  }, [customDragState.isDragging, effectiveView]);

  useEffect(() => {
    finalizeCustomDragRef.current = finalizeCustomDrag;
  }, [finalizeCustomDrag]);

  useEffect(() => {
    triggerDateChangeRef.current = triggerDateChange;
  }, [triggerDateChange]);

  useEffect(() => {
    const existingDate = prevDateAnimRef.current.date;
    if (existingDate && existingDate !== currentDate) {
      if (!prevDateAnimRef.current.direction) {
        prevDateAnimRef.current.direction = 'right';
      }
    }
    
    prevDateAnimRef.current = {
      ...prevDateAnimRef.current,
      date: currentDate
    };
  }, [currentDate]);
  
  useEffect(() => {
    const generatedEvents: KanbanEvent[] = [];
    const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const initialWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const daysInInitialWeek = eachDayOfInterval({ start: initialWeekStart, end: initialWeekEnd });

    daysInInitialWeek.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const numEvents = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < numEvents; i++) {
        const startHour = 8 + Math.floor(Math.random() * 10);
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
  }, []);

  useEffect(() => {
    setCustomDragState(prev => ({ ...prev, isDragging: false }));
  }, []);

  const iosSlideVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? '100%' : '-100%',
      opacity: 0.8,
      scale: 0.95,
      rotateY: direction === 'right' ? '-5deg' : '5deg',
      filter: 'blur(1px)',
      boxShadow: '0 10px 20px rgba(0, 0, 0, 0.1)',
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
      zIndex: 1,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: '0deg',
      filter: 'blur(0px)',
      boxShadow: 'none',
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      zIndex: 2,
      transition: {
        type: "spring", 
        stiffness: 350, 
        damping: 30,
        mass: 0.8,
        opacity: { duration: 0.2, ease: "easeOut" },
        scale: { duration: 0.3, ease: [0.34, 1.26, 0.64, 1] },
        rotateY: { duration: 0.4, ease: "easeOut" },
        filter: { duration: 0.2, ease: "easeOut" },
      }
    },
    exit: (direction: 'left' | 'right') => ({
      x: direction === 'right' ? '-30%' : '30%',
      opacity: 0.5,
      scale: 0.96,
      rotateY: direction === 'right' ? '5deg' : '-5deg',
      filter: 'blur(1px)',
      boxShadow: '0 5px 15px rgba(0, 0, 0, 0.05)',
      position: 'absolute' as const,
      width: '100%',
      height: '100%',
      zIndex: 1,
      transition: {
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        mass: 0.8,
        opacity: { duration: 0.2, ease: "easeIn" },
        scale: { duration: 0.2, ease: "easeIn" },
        rotateY: { duration: 0.25, ease: "easeIn" },
        filter: { duration: 0.2, ease: "easeIn" },
      }
    }),
  };

  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = 'none';
    
    return () => {
      document.body.style.touchAction = originalTouchAction;
    };
  }, [customDragState.isDragging]);

  // Listen for edge hover events from week view
  useEffect(() => {
    const handleWeekViewEdgeHover = (e: CustomEvent) => {
      if (!e.detail || !e.detail.edge) return;

      const edge = e.detail.edge as 'left' | 'right' | null;
      
      console.log(`[CalendarContainer] Received edge hover: ${edge}`);
      
      // Only update if the edge changed to avoid unnecessary updates
      if (edge !== customDragState.currentlyHovering) {
        setCustomDragState(prev => ({
          ...prev,
          currentlyHovering: edge
        }));
      }
    };

    document.addEventListener('weekViewEdgeHover', handleWeekViewEdgeHover as EventListener);
    
    return () => {
      document.removeEventListener('weekViewEdgeHover', handleWeekViewEdgeHover as EventListener);
    };
  }, [customDragState.currentlyHovering]);

  // Update the component to handle external direction changes
  useEffect(() => {
    // Store the animationDirection in the ref for any code that still relies on it
    prevDateAnimRef.current = {
      date: currentDate,
      direction: animationDirection
    };
  }, [currentDate, animationDirection]);

  // Effect to trigger date change when hovering at edges
  useEffect(() => {
    if (!customDragState.isDragging || !customDragState.currentlyHovering) return;
    
    // Don't start timer if already in transition
    if (isTransitioningRef.current || globalDragTracking.inTransition) return;
    
    // Create a timer to trigger navigation after holding at the edge
    const edgeHoverTimer = setTimeout(() => {
      if (customDragState.currentlyHovering && 
          !isTransitioningRef.current && 
          !globalDragTracking.inTransition) {
        
        // Trigger the date change in the direction of the edge hover
        triggerDateChange(customDragState.currentlyHovering);
      }
    }, EDGE_HOLD_DURATION);
    
    return () => {
      clearTimeout(edgeHoverTimer);
    };
  }, [customDragState.isDragging, customDragState.currentlyHovering, isTransitioningRef.current, globalDragTracking.inTransition, triggerDateChange]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-white rounded-b-astral shadow-sm border border-slate-100 border-t-0 flex-1 flex flex-col relative calendar-container overflow-hidden",
        customDragState.isDragging && "touch-none"
      )}
    >
      {customDragState.isDragging && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-500 h-1 animate-pulse" 
             aria-hidden="true"
        ></div>
      )}
      
      {customDragState.isDragging && globalDragTracking.inDesktopWeekView && (
        <div 
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[9999] bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg"
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        >
          {customDragState.currentlyHovering ? 'Hold to move to another week' : 'Drop to move event'}
        </div>
      )}
      
      <div className="h-full w-full flex-1 flex flex-col day-transition-container perspective-1800 preserve-3d"> 
        {effectiveView === 'week' && (
          <CalendarWeekView
            currentDate={currentDate}
            eventsByDate={eventsByDateForWeek}
            customDragState={customDragState}
            onEventClick={handleEventClick} 
            onEventMouseDown={handleEventMouseDown} 
          />
        )}
        {effectiveView === 'day' && (
          <AnimatePresence 
            initial={false} 
            mode="sync" 
            custom={animationDirection}
          >
            <motion.div
              key={format(currentDate, 'yyyy-MM-dd')}
              custom={animationDirection}
              variants={iosSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ 
                transformOrigin: animationDirection === 'left' ? 'right center' : 'left center',
              }}
              className="flex-1 w-full h-full bg-white will-change-transform motion-div-container preserve-3d transform-gpu"
            >
              <div className="h-full w-full bg-white rounded-b overflow-hidden calendar-day-view">
                <CalendarDayView
                  currentDate={currentDate}
                  dayEvents={filteredEvents}
                  customDragState={customDragState}
                  dayOffset={dayOffsetRef.current}
                  debugInfo={{ transitionsAttempted: 0, transitionsCompleted: 0 }}
                  onEventClick={handleEventClick} 
                  onEventMouseDown={handleEventMouseDown} 
                />
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <EventDetailModal 
        event={modalData?.event ?? null}
        isOpen={!!modalData}
        onClose={closeDetailView}
        originRect={modalData?.originRect ?? null}
      />
    </div>
  );
};

export default CalendarContainer;