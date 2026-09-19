// src/components/ui/Button.jsx
import React from 'react';

/**
 * Reusable Button component with variant support.
 * Variants: 'primary' | 'secondary' | 'ghost' | 'danger'
 */
export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:   'bg-violet-600 hover:bg-violet-500 text-white focus:ring-violet-500 shadow-lg hover:shadow-violet-500/25 active:scale-[0.98]',
    secondary: 'bg-cyan-600 hover:bg-cyan-500 text-white focus:ring-cyan-500 shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98]',
    ghost:     'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20 focus:ring-gray-500 active:scale-[0.98]',
    danger:    'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 active:scale-[0.98]',
  };

  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-5 py-2.5',
    lg: 'text-base px-7 py-3',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
        </svg>
      )}
      {children}
    </button>
  );
}
