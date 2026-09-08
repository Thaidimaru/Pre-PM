import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Modern GlassCard Container with Framer Motion hover & spring physics
 */
export function GlassCard({
  children,
  className = '',
  hoverEffect = true,
  onClick,
  ...props
}) {
  const Component = hoverEffect ? motion.div : 'div';
  const motionProps = hoverEffect
    ? {
        whileHover: { y: -3, transition: { duration: 0.2, ease: 'easeOut' } },
        whileTap: { scale: 0.99 }
      }
    : {};

  return (
    <Component
      className={cn(
        'relative overflow-hidden rounded-2xl border border-[rgba(56,149,255,0.22)] bg-[linear-gradient(145deg,rgba(14,33,58,0.85),rgba(7,19,35,0.88))] p-6 shadow-2xl backdrop-blur-xl',
        className
      )}
      onClick={onClick}
      {...motionProps}
      {...props}
    >
      {/* Light sheen overlay */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.05),transparent)]"
        aria-hidden="true"
      />
      {children}
    </Component>
  );
}
