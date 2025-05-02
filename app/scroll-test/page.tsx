"use client";

import { useRef, useEffect } from 'react';

export default function ScrollTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Add scroll shadow effect
  useEffect(() => {
    const scrollContainer = contentRef.current;
    
    const handleScroll = () => {
      if (!scrollContainer) return;
      
      const topShadow = scrollContainer.querySelector('.scroll-shadow-top');
      const bottomShadow = scrollContainer.querySelector('.scroll-shadow-bottom');
      
      if (topShadow && bottomShadow) {
        // Show top shadow when scrolled down
        if (scrollContainer.scrollTop > 10) {
          topShadow.classList.add('opacity-100');
        } else {
          topShadow.classList.remove('opacity-100');
        }
        
        // Show bottom shadow when more content is available to scroll
        if (scrollContainer.scrollHeight > scrollContainer.clientHeight && 
            scrollContainer.scrollTop < (scrollContainer.scrollHeight - scrollContainer.clientHeight - 10)) {
          bottomShadow.classList.add('opacity-100');
        } else {
          bottomShadow.classList.remove('opacity-100');
        }
      }
    };
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      // Initialize state on mount
      handleScroll();
    }
    
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-blue-500 text-white p-4">
        <h1 className="text-xl font-bold">Scroll Test Page</h1>
      </header>
      
      <main className="flex-1 flex">
        <div className="w-full max-w-4xl mx-auto p-4">
          {/* Test Container 1: Fixed Height Container */}
          <h2 className="text-lg font-semibold mb-4">Test 1: Fixed Height Container (400px)</h2>
          <div 
            ref={containerRef}
            className="border-2 border-red-500 flex flex-col mb-12" 
            style={{ height: '400px' }}
          >
            {/* Header */}
            <div className="p-3 bg-gray-100 border-b sticky top-0">
              <h3 className="font-medium">Fixed Header</h3>
            </div>
            
            {/* Scrollable Content */}
            <div 
              ref={contentRef}
              className="overflow-y-auto p-4 relative bg-white"
              style={{ 
                height: 'calc(100% - 48px)',
                maxHeight: 'calc(100% - 48px)'
              }}
            >
              {/* Scroll shadow indicators */}
              <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-top"></div>
              <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-white/80 to-transparent pointer-events-none z-[1] opacity-0 transition-opacity duration-200 scroll-shadow-bottom"></div>
              
              {/* List items */}
              <div className="space-y-3">
                {Array.from({ length: 100 }, (_, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <div className="text-lg font-medium">Item #{i + 1}</div>
                    <div className="text-sm text-gray-500">This is a test item for scrolling</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Test Container 2: Percentage-based Height */}
          <h2 className="text-lg font-semibold mb-4">Test 2: Percentage Height (50vh)</h2>
          <div 
            className="border-2 border-blue-500 flex flex-col mb-12" 
            style={{ height: '50vh' }}
          >
            {/* Header */}
            <div className="p-3 bg-gray-100 border-b sticky top-0">
              <h3 className="font-medium">Percentage Header</h3>
            </div>
            
            {/* Scrollable Content */}
            <div 
              className="overflow-y-auto p-4 relative bg-white"
              style={{ 
                height: 'calc(100% - 48px)',
                maxHeight: 'calc(100% - 48px)'
              }}
            >
              {/* List items */}
              <div className="space-y-3">
                {Array.from({ length: 100 }, (_, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <div className="text-lg font-medium">Item #{i + 1}</div>
                    <div className="text-sm text-gray-500">This is a test item for scrolling</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Test Container 3: Flex Height */}
          <h2 className="text-lg font-semibold mb-4">Test 3: Flex-based Height</h2>
          <div 
            className="border-2 border-green-500 flex flex-col mb-12" 
            style={{ height: '400px' }}
          >
            {/* Header */}
            <div className="p-3 bg-gray-100 border-b">
              <h3 className="font-medium">Flex Header</h3>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 relative bg-white">
              {/* List items */}
              <div className="space-y-3">
                {Array.from({ length: 100 }, (_, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                  >
                    <div className="text-lg font-medium">Item #{i + 1}</div>
                    <div className="text-sm text-gray-500">This is a test item for scrolling</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 