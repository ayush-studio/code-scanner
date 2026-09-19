// src/components/ui/Card.jsx
import React from 'react';

/**
 * Responsive Glassmorphism Card component with full Dark & Light mode support.
 */
export default function Card({ children, className = '', glow = false, ...props }) {
  return (
    <div
      className={`
        relative rounded-2xl border transition-all duration-300
        bg-white/80 dark:bg-slate-900/60
        border-slate-200/80 dark:border-slate-800/80
        backdrop-blur-md text-slate-900 dark:text-slate-100
        shadow-sm dark:shadow-none
        ${glow ? 'hover:shadow-md dark:hover:shadow-violet-500/10 hover:border-violet-300 dark:hover:border-violet-500/30' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  );
}
