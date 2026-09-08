import React from 'react';
import { cn } from '@/lib/utils';

/**
 * React Bits - ShinyText Component
 * Animated kinetic text with smooth light sweep gradient
 */
export function ShinyText({ children, className = '', shimmerWidth = 100 }) {
  return (
    <span
      className={cn(
        'inline-block py-1 -my-1 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] bg-clip-text text-transparent bg-[linear-gradient(110deg,#edf6ff_35%,#68e4e0_50%,#edf6ff_65%)] bg-[length:250%_100%] animate-shine font-bold tracking-normal leading-normal',
        className
      )}
    >
      {children}
    </span>
  );
}
