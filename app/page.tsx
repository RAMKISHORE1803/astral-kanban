"use client";

import { useState, useEffect } from "react";
import Header from "./components/calendar/Header";
import CalendarContainer from "./components/calendar/CalendarContainer";
import { useMediaQuery } from "./lib/hooks/useMediaQuery";
import { format } from "date-fns";

export default function Home() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  // Default to week view
  const [view, setView] = useState<"week" | "day">("week");

  // Set view based on device - no more toggling
  useEffect(() => {
    // Mobile gets day view, desktop always shows week view
    if (isMobile) {
      setView("day");
    } else {
      setView("week");
    }
  }, [isMobile]);

  // Function to handle date changes from header or container (swipe/drag)
  const handleDateChange = (newDate: Date) => {
    console.log(`[Home] handleDateChange received: ${format(newDate, 'yyyy-MM-dd')}`);
    setCurrentDate(newDate);
  };

  // We no longer need a separate view toggle handler since we're removing that functionality
  // The view is now determined solely by the device size

  return (
    <main className="flex h-screen max-h-screen flex-col bg-astral-light-gray overflow-hidden">
      <Header 
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={(newView) => {}} // Empty function since we no longer allow toggling
      />
      <div className="flex-1 p-0 md:p-4 overflow-hidden relative">
        <CalendarContainer 
          currentDate={currentDate}
          view={view}
          onDateChange={handleDateChange}
        />
      </div>
    </main>
  );
}