"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { format, addDays, subDays } from 'date-fns';
import type { KanbanEvent, CustomDragState } from '@/app/types/calendar';
import { EDGE_ZONE_WIDTH_PERCENTAGE, TRANSITION_COOLDOWN, EDGE_HOLD_DURATION } from '@/app/lib/constants';
// REMOVE incorrect import: import { updateGlobalOverlayPosition, snapToPosition, globalDragTracking } from './dragDropUtils';

// Assume these are accessible from the scope where the hook is used or imported correctly elsewhere
// @ts-ignore - Temporary: Assume global or imported elsewhere
declare var globalDragTracking: any; 
// @ts-ignore - Temporary: Assume global or imported elsewhere
declare var updateGlobalOverlayPosition: () => void;
// @ts-ignore - Temporary: Assume global or imported elsewhere
declare var snapToPosition: (targetX: number, targetY: number, onComplete: () => void) => void;

interface UseCalendarDragDropProps {
  initialEvents: KanbanEvent[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  effectiveView: 'day' | 'week';
  containerRef: React.RefObject<HTMLDivElement>; // Pass container ref
}

export function useCalendarDragDrop({
  initialEvents, 
  currentDate, 
  onDateChange, 
  effectiveView,
  containerRef
}: UseCalendarDragDropProps) {

  const [allEvents, setAllEvents] = useState<KanbanEvent[]>(initialEvents);
  const [customDragState, setCustomDragState] = useState<CustomDragState>({
    isDragging: false,
    event: null,
    position: null,
    startedOn: null,
    currentlyHovering: null,
    dropTargetId: null
  });

  // Internal Refs for drag logic
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
  const prevDateAnimRef = useRef<{ date: Date | null, direction: 'left' | 'right' | null }>({ date: null, direction: null });
  const edgeHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const edgeHoverDirectionRef = useRef<'left' | 'right' | null>(null);
  const dayOffsetRef = useRef(0);
  const edgeTransitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Core Drag & Drop Callbacks (Internal to Hook) ---

  const finalizeCustomDrag = useCallback(() => {
    if (!customDragState.isDragging || !customDragState.event) return;
    console.log("Finalizing drag...");
    
    if (globalDragTracking.inTransition || isTransitioningRef.current) {
      globalDragTracking.dropPending = true; // Mark pending
      // Simple timeout check, could be more robust
      setTimeout(() => { if (globalDragTracking.dropPending) finalizeCustomDrag(); }, 150); 
      return;
    }
    
    globalDragTracking.isTracking = false;
    globalDragTracking.dropPending = false;
    if (globalDragTracking.animationFrame) {
      cancelAnimationFrame(globalDragTracking.animationFrame);
      globalDragTracking.animationFrame = null;
    }
    
    let targetDateStr = globalDragTracking.lastDetectedColumn || format(currentDate, "yyyy-MM-dd");
    const droppedEvent = customDragState.event;
    let insertAt = -1;
    
    if (droppedEvent && customDragState.position) {
      const { x, y } = customDragState.position;
      const elementsAtPoint = document.elementsFromPoint(x, y);
      const columnElement = elementsAtPoint.find(el => el.hasAttribute('data-date') || el.closest('[data-date]'));
      if (columnElement) {
        const dateAttr = columnElement.getAttribute('data-date') || columnElement.closest('[data-date]')?.getAttribute('data-date');
        if (dateAttr) targetDateStr = dateAttr;
      }
      const eventCardElement = elementsAtPoint.find(el => el.classList.contains('event-card') || el.closest('.event-card'));
      if (eventCardElement) {
        const eventCard = eventCardElement.closest('.event-card');
        const targetEventId = eventCard?.getAttribute('data-event-id');
        if (targetEventId) {
          const targetIndex = allEvents.filter(e => e.date === targetDateStr).findIndex(e => e.id === targetEventId);
          if (targetIndex !== -1) insertAt = targetIndex;
        }
      }
    }
    
    console.log(`Moving event "${droppedEvent.title}" to ${targetDateStr}`);
    
    globalDragTracking.synchronizingWithReact = true;
    flushSync(() => {
      setAllEvents(prevEvents => {
         const eventsWithoutDragged = prevEvents.filter(e => e.id !== droppedEvent.id);
         const updatedEvent = { ...droppedEvent, date: targetDateStr };
         if (insertAt === -1) {
           return [...eventsWithoutDragged, updatedEvent];
         } else {
           const dateEvents = eventsWithoutDragged.filter(e => e.date === targetDateStr);
           const newDateEvents = [...dateEvents];
           newDateEvents.splice(insertAt, 0, updatedEvent);
           return [...eventsWithoutDragged.filter(e => e.date !== targetDateStr), ...newDateEvents];
         }
      });
      setCustomDragState({ isDragging: false, event: null, position: null, startedOn: null, currentlyHovering: null, dropTargetId: null });
    });
    
    requestAnimationFrame(() => {
      const newCardElement = document.querySelector(`[data-event-id="${droppedEvent.id}"]`);
      if (newCardElement && globalDragTracking.activeOverlay) {
        const targetRect = newCardElement.getBoundingClientRect();
        snapToPosition(targetRect.left, targetRect.top, () => {
          if (globalDragTracking.activeOverlay) globalDragTracking.activeOverlay.style.display = 'none';
          if (navigator.vibrate) navigator.vibrate(10);
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

  }, [customDragState, currentDate, allEvents]); // Dependencies needed within the callback

  const triggerDateChange = useCallback((direction: 'left' | 'right') => {
    if (isTransitioningRef.current || globalDragTracking.inTransition) return;
    const now = Date.now();
    if (now - lastTransitionTimeRef.current < TRANSITION_COOLDOWN) return;
    
    console.log(`Triggering date change to ${direction}`);
    isTransitioningRef.current = true;
    globalDragTracking.inTransition = true;
    lastTransitionTimeRef.current = now;
    globalDragTracking.edgeDetectionEnabled = false;
    
    if (edgeHoldTimerRef.current) {
        clearTimeout(edgeHoldTimerRef.current);
        edgeHoldTimerRef.current = null;
    }
    edgeHoverDirectionRef.current = null;

    if (customDragState.isDragging && globalDragTracking.activeOverlay) {
        const cardElement = globalDragTracking.activeOverlay.querySelector('div');
        if (cardElement) cardElement.classList.add('pulse-outline');
    }
    
    const newDate = direction === 'left' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    const newDateStr = format(newDate, "yyyy-MM-dd");
    
    globalDragTracking.lastDetectedColumn = newDateStr;
    dayOffsetRef.current += direction === 'left' ? -1 : 1;
    if (navigator.vibrate) navigator.vibrate(25);
    
    if (customDragState.isDragging && customDragState.event) {
      const updatedEvent = { ...customDragState.event, date: newDateStr };
      globalDragTracking.synchronizingWithReact = true;
      setCustomDragState(prev => ({ ...prev, event: updatedEvent, currentlyHovering: null, dropTargetId: null }));
    }
    
    prevDateAnimRef.current = { date: currentDate, direction }; 
    onDateChange(newDate); // Call prop function passed into hook
    
    setTimeout(() => {
      if (globalDragTracking.activeOverlay) {
        const cardElement = globalDragTracking.activeOverlay.querySelector('div');
        if (cardElement) cardElement.classList.remove('pulse-outline');
      }
      isTransitioningRef.current = false;
      globalDragTracking.inTransition = false;
      globalDragTracking.synchronizingWithReact = false;
      console.log("Transition complete");

      if (globalDragTracking.dropPending) {
        finalizeCustomDrag();
        return;
      }
      
      setTimeout(() => {
        console.log("Re-enabling edge detection");
        globalDragTracking.edgeDetectionEnabled = true;
        edgeHoverDirectionRef.current = null;
        if (edgeHoldTimerRef.current) {
           clearTimeout(edgeHoldTimerRef.current);
           edgeHoldTimerRef.current = null;
        } 
      }, TRANSITION_COOLDOWN);
      
    }, 300);
  }, [customDragState, currentDate, onDateChange, finalizeCustomDrag]); // Include dependencies

  const startCustomDrag = useCallback((event: KanbanEvent, clientX: number, clientY: number) => {
    dayOffsetRef.current = 0;
    isTransitioningRef.current = false;
    Object.assign(globalDragTracking, { 
        inTransition: false, synchronizingWithReact: false, dropPending: false,
        lastDetectedColumn: event.date, edgeDetectionEnabled: true, 
        isTracking: true, currentPosition: { x: clientX, y: clientY } 
    });

    if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
    edgeHoldTimerRef.current = null;
    edgeHoverDirectionRef.current = null;

    if (globalDragTracking.activeOverlay) {
      globalDragTracking.activeOverlay.innerHTML = ''; // Clear previous
      // Simplified overlay setup - assumes utils handle HTML creation
       const eventCardHtml = `
        <div class="bg-white rounded-lg border border-slate-200 shadow-lg p-3" style="width: auto; max-width: 320px; transform: scale(1.05); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25); will-change: transform; backface-visibility: hidden;">
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

      const originalCard = document.querySelector(`[data-event-id="${event.id}"]`);
      if (originalCard) {
        const originalRect = originalCard.getBoundingClientRect();
        globalDragTracking.activeOverlay.style.transform = `translate3d(${originalRect.left}px, ${originalRect.top}px, 0)`;
        setTimeout(() => {
          if (!globalDragTracking.activeOverlay) return;
          globalDragTracking.activeOverlay.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
          const cardEl = globalDragTracking.activeOverlay.querySelector('div');
          const w = cardEl?.offsetWidth ?? 200;
          const h = cardEl?.offsetHeight ?? 100;
          globalDragTracking.activeOverlay.style.transform = `translate3d(${clientX - w / 2}px, ${clientY - h / 2}px, 0)`;
          setTimeout(() => {
            if (globalDragTracking.activeOverlay) globalDragTracking.activeOverlay.style.transition = 'none';
            if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
            globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
          }, 150);
        }, 0);
      } else {
          // Fallback positioning
          const cardEl = globalDragTracking.activeOverlay.querySelector('div');
          const w = cardEl?.offsetWidth ?? 200;
          const h = cardEl?.offsetHeight ?? 100;
          globalDragTracking.activeOverlay.style.transform = `translate3d(${clientX - w / 2}px, ${clientY - h / 2}px, 0)`;
          if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
          globalDragTracking.animationFrame = requestAnimationFrame(updateGlobalOverlayPosition);
      }
      if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
    }
    
    setCustomDragState({ isDragging: true, event, position: { x: clientX, y: clientY }, startedOn: event.date, currentlyHovering: null, dropTargetId: null });
    document.body.style.overflow = 'hidden';
    document.body.classList.add('calendar-dragging');
  }, []); // Dependencies carefully managed if needed

  const cancelCustomDrag = useCallback(() => {
     if (!customDragState.isDragging) return;
     console.log("Cancelling drag...");
     globalDragTracking.isTracking = false;
     if (globalDragTracking.animationFrame) cancelAnimationFrame(globalDragTracking.animationFrame);
     globalDragTracking.animationFrame = null;
     if (globalDragTracking.activeOverlay) {
       // Fade out cancellation
       globalDragTracking.activeOverlay.style.transition = 'opacity 0.2s ease';
       globalDragTracking.activeOverlay.style.opacity = '0';
       setTimeout(() => { if (globalDragTracking.activeOverlay) globalDragTracking.activeOverlay.style.display = 'none'; }, 200);
     }
     setCustomDragState({ isDragging: false, event: null, position: null, startedOn: null, currentlyHovering: null, dropTargetId: null });
     Object.assign(globalDragTracking, { inTransition: false, dropPending: false, edgeDetectionEnabled: true });
     if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
     edgeHoldTimerRef.current = null;
     edgeHoverDirectionRef.current = null;
     document.body.style.overflow = '';
     document.body.classList.remove('calendar-dragging');
  }, [customDragState.isDragging]);

  // --- Effect for Pointer Listeners ---
  useEffect(() => {
    if (!customDragState.isDragging) return;
    
    const handlePointerMove = (e: PointerEvent) => {
       globalDragTracking.currentPosition = { x: e.clientX, y: e.clientY };
       setCustomDragState(prev => ({ ...prev, position: { x: e.clientX, y: e.clientY } }));
       
       if (!isTransitioningRef.current && !globalDragTracking.inTransition && globalDragTracking.edgeDetectionEnabled && effectiveView === 'day') {
          const container = containerRef.current; // Use passed ref
          if (container) {
              const containerRect = container.getBoundingClientRect();
              const edgeWidth = containerRect.width * EDGE_ZONE_WIDTH_PERCENTAGE;
              const leftEdgeBoundary = containerRect.left + edgeWidth;
              const rightEdgeBoundary = containerRect.right - edgeWidth;
              let currentEdge: 'left' | 'right' | null = null;
              if (e.clientX < leftEdgeBoundary) currentEdge = 'left';
              else if (e.clientX > rightEdgeBoundary) currentEdge = 'right';
              
              if (currentEdge !== customDragState.currentlyHovering) {
                 setCustomDragState(prev => ({ ...prev, currentlyHovering: currentEdge }));
                 if (currentEdge && navigator.vibrate) navigator.vibrate(10);
              }

              if (currentEdge !== edgeHoverDirectionRef.current) {
                  if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
                  edgeHoldTimerRef.current = null;
                  edgeHoverDirectionRef.current = currentEdge;
                  if (currentEdge) {
                      edgeHoldTimerRef.current = setTimeout(() => {
                          const trackedEdge = edgeHoverDirectionRef.current;
                          if (!isTransitioningRef.current && !globalDragTracking.inTransition && globalDragTracking.edgeDetectionEnabled) {
                              const posX = globalDragTracking.currentPosition.x;
                              const cont = containerRef.current;
                              if (cont && trackedEdge) {
                                const rectNow = cont.getBoundingClientRect();
                                const widthNow = rectNow.width * EDGE_ZONE_WIDTH_PERCENTAGE;
                                const stillLeft = posX < rectNow.left + widthNow;
                                const stillRight = posX > rectNow.right - widthNow;
                                const finalDir = stillLeft ? 'left' : (stillRight ? 'right' : null);
                                if (finalDir === trackedEdge) {
                                    if (triggerDateChangeRef.current) triggerDateChangeRef.current(trackedEdge);
                                } 
                              }
                          }
                          edgeHoldTimerRef.current = null;
                      }, EDGE_HOLD_DURATION);
                  }
              }
              // Drop target detection needs access to allEvents
              const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
              const columnElement = elementsAtPoint.find(el => el.hasAttribute('data-date') || el.closest('[data-date]'));
              if (columnElement) {
                  const dateAttr = columnElement.getAttribute('data-date') || columnElement.closest('[data-date]')?.getAttribute('data-date');
                  if (dateAttr && dateAttr !== globalDragTracking.lastDetectedColumn) {
                      globalDragTracking.lastDetectedColumn = dateAttr;
                  }
              }
              const eventCardElement = elementsAtPoint.find(el => el.classList.contains('event-card') || el.closest('.event-card'));
              const bottomDropZone = elementsAtPoint.find(el => el.getAttribute('data-drop-zone') === 'bottom');
              let targetEventId: string | null = eventCardElement?.closest('.event-card')?.getAttribute('data-event-id') || null;
              if (!targetEventId && bottomDropZone && allEvents.filter(ev => ev.date === globalDragTracking.lastDetectedColumn).length > 0) {
                  const eventsInCol = allEvents.filter(ev => ev.date === globalDragTracking.lastDetectedColumn);
                  targetEventId = eventsInCol[eventsInCol.length - 1].id; // Target last element for bottom drop
              }
              if (customDragState.dropTargetId !== targetEventId) {
                  setCustomDragState(prev => ({ ...prev, dropTargetId: targetEventId }));
              }
          }
       }
    };
    
    const handlePointerEnd = (e: PointerEvent) => {
      if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
      edgeHoldTimerRef.current = null;
      edgeHoverDirectionRef.current = null;
      if (!globalDragTracking.isTracking) return;
      if (isTransitioningRef.current || globalDragTracking.inTransition) {
        globalDragTracking.dropPending = true;
        return;
      }
      // Use ref for finalize call
      if(finalizeCustomDragRef.current) finalizeCustomDragRef.current(); 
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
       if (edgeHoldTimerRef.current) clearTimeout(edgeHoldTimerRef.current);
       edgeHoldTimerRef.current = null;
       edgeHoverDirectionRef.current = null;
    };
   }, [customDragState.isDragging, effectiveView, allEvents, containerRef]); // Add containerRef dependency

  // --- Other Effects ---
  
  // Effect to initialize global overlay element
  useEffect(() => {
    const overlay = document.createElement('div');
    overlay.id = 'global-drag-overlay';
    Object.assign(overlay.style, { position: 'fixed', pointerEvents: 'none', zIndex: '9999', top: '0', left: '0', display: 'none', transformOrigin: 'center center', willChange: 'transform', backfaceVisibility: 'hidden' });
    document.body.appendChild(overlay);
    globalDragTracking.activeOverlay = overlay;
    return () => { 
        if (globalDragTracking.activeOverlay) document.body.removeChild(globalDragTracking.activeOverlay); 
        globalDragTracking.activeOverlay = null;
    };
  }, []);

  // Update refs for external access (if needed by other components)
  useEffect(() => { finalizeCustomDragRef.current = finalizeCustomDrag; }, [finalizeCustomDrag]);
  useEffect(() => { triggerDateChangeRef.current = triggerDateChange; }, [triggerDateChange]);

  // Return ONLY the necessary values/functions for the parent component
  return {
    allEvents,
    setAllEvents,
    customDragState,
    startCustomDrag,
    cancelCustomDrag,
    dayOffset: dayOffsetRef.current,
    prevDateAnimRef
  };
} 