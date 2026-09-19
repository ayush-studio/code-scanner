// src/components/scanner/AnalysisControls.jsx
import React from 'react';
import { Zap, RotateCcw } from 'lucide-react';
import Button from '../ui/Button';

/**
 * The main "Analyze" and "Reset" action buttons shown below the input methods.
 */
export default function AnalysisControls({ onAnalyze, onReset, canAnalyze, isLoading }) {
  return (
    <div className="flex gap-3">
      <Button
        onClick={onAnalyze}
        variant="primary"
        size="lg"
        className="flex-1"
        disabled={!canAnalyze || isLoading}
        loading={isLoading}
      >
        <Zap className="w-4 h-4" />
        {isLoading ? 'Analyzing…' : 'Analyze Codebase'}
      </Button>
      <Button
        onClick={onReset}
        variant="ghost"
        size="lg"
        disabled={isLoading}
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  );
}
