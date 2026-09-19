// src/App.jsx
import React from 'react';
import useAnalysisStore from './store/useAnalysisStore';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';

/**
 * Root application component.
 * Switches between LandingPage and DashboardPage based on analysis status.
 * No React Router needed — simple status-driven navigation.
 */
export default function App() {
  const { status, reset } = useAnalysisStore();
  const showDashboard = status === 'done' || status === 'analyzing' || status === 'uploading' || status === 'fetching_git';

  const handleDone = () => {
    // DashboardPage will auto-show because status changes to 'done' via store
  };

  const handleBack = () => {
    reset();
  };

  return showDashboard
    ? <DashboardPage onBack={handleBack} />
    : <LandingPage onDone={handleDone} />;
}
