"use client";

import { useState, useCallback, useRef } from 'react';
import type { KanbanEvent, OriginRect } from '@/app/types/calendar';

interface ModalData {
  event: KanbanEvent;
  originRect: OriginRect | null; // Allow null for fallback
}

export function useEventDetailModal() {
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const originRectRef = useRef<OriginRect | null>(null); // Use ref to avoid passing rect object directly if possible

  const openModal = useCallback((event: KanbanEvent, cardElement: HTMLElement | null) => {
    let calculatedRect: OriginRect | null = null;
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      calculatedRect = { 
        x: rect.left, 
        y: rect.top, 
        width: rect.width, 
        height: rect.height, 
        scrollY: window.scrollY 
      };
      originRectRef.current = calculatedRect; // Store in ref
    } else {
      console.warn('Cannot calculate originRect, opening modal without animation origin.');
      originRectRef.current = null;
    }
    
    setModalData({ event: event, originRect: calculatedRect }); // Set state with event and potentially null rect
    document.body.style.overflow = 'hidden'; 
  }, []);

  const closeModal = useCallback(() => {
    setModalData(null);
    originRectRef.current = null;
    document.body.style.overflow = ''; 
  }, []);

  return {
    modalEvent: modalData?.event ?? null,
    isModalOpen: !!modalData,
    modalOriginRect: modalData?.originRect ?? null, // Pass rect from state 
    // modalOriginRect: originRectRef.current, // Alternatively pass the ref value if needed 
    openModal,
    closeModal,
  };
} 