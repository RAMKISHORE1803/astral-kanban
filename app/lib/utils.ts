import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Event as CalendarEvent } from "./eventData";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Event type for our Calendar implementation
export type KanbanEvent = CalendarEvent & {
  date: string;
};

// Convert a date string to a JavaScript Date object
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

// Parse a time string like "09:00 AM" to get hours and minutes
export function parseTime(timeString: string): { hours: number; minutes: number } {
  const [time, period] = timeString.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

// Combine a date string and time string to create a Date object
export function createDateWithTime(dateString: string, timeString: string): Date {
  const date = parseDate(dateString);
  const { hours, minutes } = parseTime(timeString);
  
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Format a date for display
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
} 