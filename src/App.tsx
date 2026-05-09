/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { UserProfile } from './types';
import { getToken, clearToken } from './lib/api';

// 组件
import { Navbar } from './components/Layout/Navbar';
import { SuperAdminView } from './components/Admin/SuperAdminView';
import { LoginView } from './components/Auth/LoginView';
import { ParentView } from './components/Parent/ParentView';
import { ChildView } from './components/Child/ChildView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('kiddie_theme') || 'default');

  // 页面加载时验证 token 有效性，实现自动登录
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setInitializing(false);
      return;
    }
    fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCurrentUser(data.user);
          localStorage.setItem('kiddie_user', JSON.stringify(data.user));
        } else {
          clearToken();
          localStorage.removeItem('kiddie_user');
        }
      })
      .catch(() => {
        clearToken();
        localStorage.removeItem('kiddie_user');
      })
      .finally(() => setInitializing(false));
  }, []);

  const handleLogin = (user: UserProfile, token?: string) => {
    setCurrentUser(user);
    localStorage.setItem('kiddie_user', JSON.stringify(user));
    if (token) localStorage.setItem('kiddie_token', token);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kiddie_user');
    localStorage.removeItem('kiddie_token');
    window.history.pushState({}, '', window.location.pathname);
  };

  if (initializing) {
    return (
      <div className={`min-h-screen theme-transition flex items-center justify-center ${theme !== 'default' ? `theme-${theme}` : ''}`}>
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className={`min-h-screen theme-transition ${theme !== 'default' ? `theme-${theme}` : ''}`}>
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      {currentUser.role === 'admin' ? (
        <div className={`min-h-screen theme-transition flex flex-col ${theme !== 'default' ? `theme-${theme}` : ''}`}>
          <Navbar 
            user={currentUser} 
            onLogout={handleLogout}
            onSetTheme={setTheme}
            currentTheme={theme}
          />
          <div className="flex-1 overflow-auto bg-gray-50 pt-20">
            <SuperAdminView onLogout={handleLogout} />
          </div>
        </div>
      ) : currentUser.role === 'child' ? (
        <div className={`min-h-screen bg-gray-50/50 theme-transition ${theme !== 'default' ? `theme-${theme}` : ''}`}>
          <Navbar 
            user={currentUser} 
            onLogout={handleLogout} 
            onSetTheme={setTheme}
            currentTheme={theme}
          />
          <ChildView user={currentUser} />
        </div>
      ) : (
        <div className={`min-h-screen bg-gray-50/50 theme-transition ${theme !== 'default' ? `theme-${theme}` : ''}`}>
          <Navbar 
            user={currentUser} 
            onLogout={handleLogout} 
            onSetTheme={setTheme}
            currentTheme={theme}
          />
          <ParentView user={currentUser} onLogout={handleLogout} onSetTheme={setTheme} currentTheme={theme} />
        </div>
      )}
    </BrowserRouter>
  );
}
