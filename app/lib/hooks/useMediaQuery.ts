"use client";

import { useState, useEffect } from 'react';

// Simple media query hook (consider a more robust library for complex cases)
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const updateMatches = () => {
      setMatches(mediaQuery.matches);
    };

    // Initial check
    updateMatches();

    // Listen for changes
    mediaQuery.addEventListener('change', updateMatches);

    // Cleanup listener
    return () => {
      mediaQuery.removeEventListener('change', updateMatches);
    };
  }, [query]);

  return matches;
} 