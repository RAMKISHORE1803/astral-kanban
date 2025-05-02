"use client";

import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../ui/Button";
import { cn } from "@/app/lib/utils";
import { useMediaQuery } from "@/app/lib/hooks/useMediaQuery";
import type { HeaderProps } from "@/app/types/calendar";

const Header = ({ currentDate, onDateChange, view }: HeaderProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
    if (isMobile) {
      return format(currentDate, "MMMM d, yyyy");
    } else if (view === "day") {
      // Desktop day view - show full date
      return format(currentDate, "EEEE, MMMM d, yyyy");
    } else {
      // Desktop Week view: Show exact date range with dates
      const startDate = format(weekStart, "MMM d");
      const endDate = format(weekEnd, "MMM d");
      const year = format(currentDate, "yyyy");
      
      // If both dates are in the same month
      if (format(weekStart, "MMM") === format(weekEnd, "MMM")) {
        return `${startDate} - ${format(weekEnd, "d")}, ${year}`;
      }
      
      // If dates span different months
      return `${startDate} - ${endDate}, ${year}`;
    }
  };

  const isToday = isSameDay(currentDate, new Date());
  
  // Enhanced button styles with gradients and better active states
  const iconButtonStyle = "p-2 text-slate-600 hover:bg-gradient-to-b hover:from-blue-50 hover:to-slate-100 active:from-blue-100 active:to-slate-200 rounded-full transition-all shadow-sm";
  
  const textButtonStyle = "px-4 py-1.5 text-sm font-medium rounded-full transition-all shadow-sm";
  
  const todayButtonStyle = cn(
    textButtonStyle,
    isToday 
      ? "bg-gradient-to-r from-astral-blue to-blue-500 text-white shadow-md" 
      : "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 hover:from-blue-50 hover:to-blue-100 hover:text-blue-600"
  );

  return (
    // Enhanced header with gradient background
    <header className="bg-gradient-to-b from-blue-50 to-white pt-3 pb-2 px-4 md:px-6 border-b border-slate-200 flex flex-col shrink-0 shadow-sm">
      {/* Top Row */}
      <div className="flex items-center justify-between gap-2 md:gap-4 mb-2">
         {/* Left Section: Logo, Today, Navigation */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="flex items-center font-bold text-xl">
            <span className="text-blue-600 relative mr-1">
              A<span className="absolute text-[6px] text-white top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">&#9734;</span>
            </span>
            <span className="text-blue-600">STRAL</span>
          </div>
          
          <Button 
            variant="secondary" 
            className={todayButtonStyle}
            onClick={today}
          >
            Today
          </Button>

          {/* Navigation Arrows with enhanced styles */}
          <div className="flex items-center gap-2">
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
          
          {/* Enhanced Date Range Display */}
          <motion.div
              className="bg-gradient-to-r from-white/80 to-white/50 backdrop-blur-sm shadow-sm px-4 py-1.5 rounded-full ml-1"
              key={getDateRangeText()} // Animate when text changes
              initial={{ opacity: 0.5, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-slate-800 font-semibold text-base md:text-lg">
                {getDateRangeText()}
              </h2>
            </motion.div>
        </div>
      </div>

      {/* Bottom Row: Week Day Selector (Mobile) - Enhanced with gradients */}
      {isMobile && (
        <div className="flex justify-between items-center relative border-t border-slate-100 pt-2 mt-1">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, currentDate);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateChange(day)}
                className={cn(
                  "flex-1 text-center py-1.5 rounded-md relative transition-all duration-200 flex flex-col items-center group",
                  !isSelected && "text-slate-500 hover:bg-blue-50/50",
                  isSelected && "text-blue-600 font-semibold"
                )}
              >
                <span className={cn(
                  "text-[10px] uppercase tracking-wider font-medium",
                  isSelected && "text-blue-500"
                )}>
                  {format(day, "EEE")}
                </span>
                <span className={cn(
                    "mt-1 text-lg font-medium relative rounded-full h-8 w-8 flex items-center justify-center transition-all",
                     isSelected 
                       ? "bg-gradient-to-br from-blue-400 to-astral-blue text-white shadow-md" 
                       : "text-slate-700 group-hover:bg-blue-100/50"
                )}>
                  {format(day, "d")}
                </span>
                {isSelected && (
                  <div className="absolute bottom-0 w-10 h-0.5 bg-gradient-to-r from-astral-blue to-blue-500 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default Header;