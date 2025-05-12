"use client";

import { useState, useEffect } from "react";
import Header from "./components/calendar/Header";
import CalendarContainer from "./components/calendar/CalendarContainer";
import { useMediaQuery } from "./lib/hooks/useMediaQuery";
import { format } from "date-fns";

export default function Home() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<"week" | "day">("week");
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');

  // Set view based on device 
  useEffect(() => {
    if (isMobile) {
      setView("day");
    } else {
      setView("week");
    }
  }, [isMobile]);

  // Function to handle date changes from header or container (swipe/drag)
  const handleDateChange = (newDate: Date, direction?: 'left' | 'right') => {
    console.log(`[Home] handleDateChange received: ${format(newDate, 'yyyy-MM-dd')}${direction ? `, direction: ${direction}` : ''}`);
    
    // Update animation direction if provided
    if (direction) {
      setAnimationDirection(direction);
    }
    
    // Set the current date
    setCurrentDate(newDate);
  };


  return (
    <main className="flex h-screen max-h-screen flex-col bg-astral-light-gray overflow-hidden">
      <Header 
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
      />
      <div className="flex-1 p-0 md:p-4 overflow-hidden relative">
        <CalendarContainer 
          currentDate={currentDate}
          view={view}
          onDateChange={handleDateChange}
          animationDirection={animationDirection}
        />
      </div>
    </main>
  );
}