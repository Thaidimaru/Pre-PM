import React, { useState, useEffect } from 'react';
import { Spotlight } from '@/components/ui/spotlight';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { FieldVisitView } from '@/components/field/FieldVisitView';
import { LoginView } from '@/components/auth/LoginView';

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('surveyToken') || '');
  const [currentPage, setCurrentPage] = useState(() => {
    const path = window.location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path === '/login') return 'login';
    return 'field';
  });

  const navigateTo = (page) => {
    setCurrentPage(page);
    const targetUrl = page === 'dashboard' ? '/dashboard' : page === 'login' ? '/login' : '/';
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({}, '', targetUrl);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('surveyToken');
    setToken('');
    setCurrentPage('login');
    window.history.pushState({}, '', '/login');
  };

  const handleLoginSuccess = (newToken) => {
    setToken(newToken);
    navigateTo('dashboard');
  };

  // Sync state with browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/dashboard') setCurrentPage('dashboard');
      else if (path === '/login') setCurrentPage('login');
      else setCurrentPage('field');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect to dashboard if already authenticated and browsing to /login
  useEffect(() => {
    if (token && window.location.pathname === '/login') {
      navigateTo('dashboard');
    }
  }, [token]);

  if (!token) {
    return (
      <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(8,105,255,0.18),transparent_60%),linear-gradient(135deg,#020b1b,#031a3a_48%,#020f25)] text-slate-100 flex flex-col justify-center">
        <Spotlight />
        <LoginView onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(8,105,255,0.18),transparent_60%),linear-gradient(135deg,#020b1b,#031a3a_48%,#020f25)] text-slate-100">
      <Spotlight />

      {/* Top Fixed Navbar */}
      <Navbar />

      <div className="flex">
        {/* Left Fixed Sidebar */}
        <Sidebar
          currentPage={currentPage === 'login' ? 'dashboard' : currentPage}
          onNavigate={navigateTo}
          onLogout={handleLogout}
        />

        {/* Dynamic Page Content */}
        <div className="flex-1 pl-0 lg:pl-64 transition-all duration-300">
          <div className="min-h-[calc(100vh-88px)] py-6">
            {currentPage === 'dashboard' ? (
              <DashboardView onNavigate={navigateTo} />
            ) : (
              <FieldVisitView />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
