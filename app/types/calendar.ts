import { KanbanEvent } from "@/app/lib/utils";

// Re-export KanbanEvent for easy import from components
export type { KanbanEvent };


// CalendarContainer
export interface CalendarContainerProps {
  currentDate: Date;
  view: "week" | "day";
  onDateChange: (date: Date) => void;
}

// CalendarDayView
export interface CalendarDayViewProps {
  currentDate: Date;
  dayEvents: KanbanEvent[];
  customDragState: CustomDragState; // Use shared type
  dayOffset: number;
  debugInfo: DebugInfo; // Use shared type
  onEventClick: (event: KanbanEvent) => void;
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

// CalendarWeekView
export interface CalendarWeekViewProps {
  currentDate: Date;
  eventsByDate: { [date: string]: KanbanEvent[] };
  customDragState: CustomDragState; // Use shared type
  onEventClick: (event: KanbanEvent) => void;
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
}

export interface ColumnProps {
  dateStr: string;
  dayName: string;
  dayNumber: string;
  isToday: boolean;
  events: KanbanEvent[];
  onEventClick: (event: KanbanEvent) => void;
  onEventMouseDown: (event: KanbanEvent, e: React.MouseEvent | React.TouchEvent) => void;
  customDragState: CustomDragState; // Use shared type
  isDropTarget: boolean;
  isFirstOfMonth: boolean;
  monthShort: string;
}

// EventCard
export interface EventCardProps {
  event: KanbanEvent;
  isSource?: boolean;
  isDraggable?: boolean;
  isDropTarget?: boolean;
  // REVERT to original mouse/touch event handlers
  onClick: (event: KanbanEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  // onTouchMove?: (e: React.TouchEvent) => void; // This wasn't used directly on card before
  onTouchEnd?: () => void;
  // REMOVE PointerEvent versions
  // onPointerDown?: (e: React.PointerEvent) => void; 
  // onPointerUp?: (e: React.PointerEvent) => void;
  // onPointerLeave?: (e: React.PointerEvent) => void;
}

// EventDetailModal
export interface EventDetailModalProps {
  event: KanbanEvent | null;
  isOpen: boolean; 
  onClose: () => void; 
  originRect: OriginRect | null; // Use shared type
}

// Header
export interface HeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "week" | "day";
  onViewChange: (view: "week" | "day") => void;
}

// --- Shared Internal Types --- 

// Represents the state managed by CalendarContainer for dragging
export interface CustomDragState {
  isDragging: boolean;
  event: KanbanEvent | null;
  position: { x: number; y: number } | null;
  startedOn: string | null;
  currentlyHovering: 'left' | 'right' | null;
  dropTargetId: string | null;
}

// Represents the origin rect data for modal animation
export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollY: number;
}

// Debug info structure
export interface DebugInfo {
  transitionsAttempted: number;
  transitionsCompleted: number;
}

// NEW: Export ModalData type
export type { ModalData };

// Definition for ModalData (if not already present and exported)
interface ModalData {
  event: KanbanEvent;
  originRect: OriginRect | null; // Allow null here for fallback case
}