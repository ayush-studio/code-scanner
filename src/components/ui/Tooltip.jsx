// src/components/ui/Tooltip.jsx
import React, { useState } from 'react';

/**
 * Simple hover tooltip. Position: 'top' | 'bottom' | 'left' | 'right'
 */
export default function Tooltip({ children, content, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  const positions = {
    top:    '-top-9 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left:   'right-full mr-2 top-1/2 -translate-y-1/2',
    right:  'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div className={`absolute ${positions[position]} z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded-lg whitespace-nowrap border border-white/10 pointer-events-none`}>
          {content}
        </div>
      )}
    </div>
  );
}
