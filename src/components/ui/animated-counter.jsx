import React, { useEffect, useState } from 'react';

/**
 * React Bits - AnimatedCounter Component
 * Smooth spring-like kinetic counter for KPI values
 */
export function AnimatedCounter({ value, duration = 800 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10) || 0;
    if (end === 0) {
      setCount(0);
      return;
    }

    const stepTime = 16;
    const steps = Math.max(Math.floor(duration / stepTime), 1);
    const increment = end / steps;

    const timer = setInterval(() => {
      start += increment;
      if ((increment >= 0 && start >= end) || (increment < 0 && start <= end)) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.round(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}
