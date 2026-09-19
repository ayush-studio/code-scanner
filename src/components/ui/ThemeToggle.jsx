// src/components/ui/ThemeToggle.jsx
import React, { useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import useAnalysisStore from '../../store/useAnalysisStore';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme, initTheme } = useAnalysisStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`
        relative flex items-center justify-center p-2 rounded-xl transition-all duration-300
        border border-slate-200 dark:border-slate-800
        bg-slate-100 dark:bg-slate-800/80
        text-slate-700 dark:text-slate-300
        hover:bg-slate-200 dark:hover:bg-slate-700
        hover:text-violet-600 dark:hover:text-violet-400
        shadow-sm hover:shadow
        ${className}
      `}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme mode"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-violet-600 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
}
