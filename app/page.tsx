"use client";

import { useState, useEffect } from "react";
import Header from "./components/calendar/Header";
import CalendarContainer from "./components/calendar/CalendarContainer";
import { useMediaQuery } from "./lib/hooks/useMediaQuery";

export default function Home() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  // Default to day view on mobile, week view on desktop
  const [view, setView] = useState<"week" | "day">("week");

  // Set initial view based on media query once client-side check is possible
  useEffect(() => {
    setView(isMobile ? "day" : "week");
  }, [isMobile]);

  // Function to handle date changes from header or container (swipe/drag)
  const handleDateChange = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  // Function to handle view changes
  const handleViewChange = (newView: "week" | "day") => {
    // Only allow changing view on non-mobile devices
    if (!isMobile) {
      setView(newView);
    }
  };

  return (
    <main className="flex h-screen max-h-screen flex-col bg-astral-light-gray">
      <Header 
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={handleViewChange}
      />
      <div className="flex-1 p-0 md:p-4 overflow-hidden">
        <CalendarContainer 
          currentDate={currentDate}
          view={view}
          onDateChange={handleDateChange}
        />
      </div>
    </main>
  );
}