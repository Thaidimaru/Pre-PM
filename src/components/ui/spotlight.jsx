import React, { useEffect, useState } from 'react';

/**
 * React Bits - Ambient Mouse Follow Spotlight
 */
export function Spotlight() {
  const [pos, setPos] = useState({ x: 50, y: 20 });

  useEffect(() => {
    const handleMove = (e) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-1 overflow-hidden transition-opacity duration-500"
      style={{
        background: `radial-gradient(650px circle at ${pos.x}px ${pos.y}px, rgba(8, 127, 255, 0.08), transparent 60%)`
      }}
      aria-hidden="true"
    />
  );
}
