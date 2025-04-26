"use client";

import { useState, useEffect } from "react";
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarPlus } from "lucide-react";
import Logo from "../ui/Logo";
import Button from "../ui/Button";
import { cn } from "@/app/lib/utils";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";

interface HeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "week" | "day";
  onViewChange: (view: "week" | "day") => void;
}

const Header = ({ currentDate, onDateChange, view, onViewChange }: HeaderProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Navigation logic remains the same
  const navigateToPrevious = () => {
    if (isMobile || view === "day") {
      onDateChange(subDays(currentDate, 1));
    } else {
      onDateChange(subDays(currentDate, 7));
    }
  };

  const navigateToNext = () => {
    if (isMobile || view === "day") {
      onDateChange(addDays(currentDate, 1));
    } else {
      onDateChange(addDays(currentDate, 7));
    }
  };

  const today = () => {
    onDateChange(new Date());
  };

  const getDateRangeText = () => {
    if (isMobile || view === "day") {
       return format(currentDate, "MMMM d, yyyy");
    }
    // Desktop Week view: Show Month YYYY or Month - Month YYYY
    const startMonth = format(weekStart, "MMMM");
    const endMonth = format(weekEnd, "MMMM");
    const year = format(currentDate, "yyyy");
    return startMonth === endMonth ? `${startMonth} ${year}` : `${format(weekStart, "MMM")} - ${format(weekEnd, "MMM")} ${year}`;
  };

  // GCal inspired subtle button style
  const iconButtonStyle = "p-1.5 text-slate-600 hover:bg-slate-100 rounded-full transition-colors";
  const textButtonStyle = "px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-astral transition-colors";
  const todayButtonStyle = cn(textButtonStyle, isSameDay(currentDate, new Date()) && "text-astral-blue font-semibold"); // Highlight if today

  return (
    // Lighter header, border bottom
    <header className="bg-white pt-2 pb-1 px-4 md:px-6 border-b border-slate-200 flex flex-col shrink-0">
      {/* Top Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 mb-2">
         {/* Left Section: Logo, Today, Navigation */}
        <div className="flex items-center gap-2 md:gap-3">
          <Logo className="!text-astral-blue !font-semibold"/> {/* Use brand blue */} 
          
          <Button 
            variant="secondary" 
            className={todayButtonStyle}
            onClick={today}
          >
            Today
          </Button>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-1">
              <button
                className={iconButtonStyle}
                onClick={navigateToPrevious}
                aria-label={isMobile || view === 'day' ? 'Previous Day' : 'Previous Week'}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className={iconButtonStyle}
                onClick={navigateToNext}
                aria-label={isMobile || view === 'day' ? 'Next Day' : 'Next Week'}
              >
                <ChevronRight size={20} />
              </button>
          </div>
          {/* Date Range Text */}
          <motion.h2
              className="text-slate-700 font-medium text-base md:text-lg ml-2"
              key={getDateRangeText()} // Animate when text changes
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {getDateRangeText()}
            </motion.h2>
        </div>
        
        {/* Right Section: Actions (Desktop) */}
        <div className="hidden md:flex items-center space-x-2 justify-end">
          {/* View Toggle - Desktop Only */}
          <div className="bg-slate-100 p-1 rounded-astral flex">
            <button
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-astral transition-all",
                view === "day"
                  ? "bg-white text-astral-blue shadow-sm"
                  : "text-slate-600 hover:bg-white/60"
              )}
              onClick={() => onViewChange("day")}
            >
              Day
            </button>
            <button
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-astral transition-all",
                view === "week"
                  ? "bg-white text-astral-blue shadow-sm"
                  : "text-slate-600 hover:bg-white/60"
              )}
              onClick={() => onViewChange("week")}
            >
              Week
            </button>
          </div>
          {/* Add Event Button - Simplified */}
          <Button
            className="bg-astral-yellow text-slate-800 shadow-sm hover:shadow-md flex items-center gap-1.5 px-3 py-1.5 text-sm"
            onClick={() => { /* Add event TBD */ }}
          >
            <CalendarPlus size={16} /> Create
          </Button>
        </div>
      </div>

      {/* Bottom Row: Week Day Selector (Mobile) - Simplified */}
      {isMobile && (
        <div className="flex justify-between items-center relative border-t border-slate-100 pt-1">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, currentDate);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateChange(day)}
                className={cn(
                  "flex-1 text-center py-1 rounded-md relative transition-colors duration-200 flex flex-col items-center group",
                  !isSelected && "text-slate-500 hover:bg-slate-100",
                  isSelected && "text-astral-blue font-semibold"
                )}
              >
                <span className="text-[10px] uppercase tracking-wider font-medium">{format(day, "EEE")}</span>
                <span className={cn(
                    "mt-1 text-lg font-medium relative rounded-full h-7 w-7 flex items-center justify-center transition-colors",
                     isSelected ? "bg-astral-blue/10 text-astral-blue" : "text-slate-700 group-hover:bg-slate-200"
                )}>
                  {format(day, "d")}
                </span>
                 {/* Removed layout animation for highlight - simpler underline/dot might be better GCal style */}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default Header; 