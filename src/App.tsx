/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { UserProfile } from './types';

// Components
import { Navbar } from './components/Layout/Navbar';
import { SuperAdminView } from './components/Admin/SuperAdminView';
import { LoginView } from './components/Auth/LoginView';
import { ParentView } from './components/Parent/ParentView';
import { ChildView } from './components/Child/ChildView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('kiddie_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('kiddie_theme') || 'default');
  const [isChildMode, setIsChildMode] = useState(() => {
    const savedMode = localStorage.getItem('kiddie_is_child_mode');
    if (savedMode !== null) return savedMode === 'true';
    return currentUser?.role === 'child';
  });
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    localStorage.setItem('kiddie_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('kiddie_is_child_mode', isChildMode.toString());
  }, [isChildMode]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    return () => {
      newSocket.close();
    }
  }, []);

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('kiddie_user', JSON.stringify(user));
    if (user.role === 'child') {
      setIsChildMode(true);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsChildMode(false);
    localStorage.removeItem('kiddie_user');
  };

  if (!currentUser) {
    return (
      <div className={`min-h-screen theme-transition ${theme !== 'default' ? `theme-${theme}` : ''}`}>
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  if (currentUser.role === 'admin') {
    return (
      <div className={`min-h-screen theme-transition flex flex-col ${theme !== 'default' ? `theme-${theme}` : ''}`}>
        <Navbar 
          user={currentUser} 
          socket={socket} 
          onLogout={handleLogout}
          onSetTheme={setTheme}
          currentTheme={theme}
        />
        <div className="flex-1 overflow-auto bg-gray-50 pt-20">
          <SuperAdminView onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className={`min-h-screen bg-gray-50/50 theme-transition ${theme !== 'default' ? `theme-${theme}` : ''}`}>
        <Navbar 
          user={currentUser} 
          socket={socket} 
          onLogout={handleLogout} 
          isChildMode={isChildMode}
          onSwitchMode={() => setIsChildMode(!isChildMode)}
          onSetTheme={setTheme}
          currentTheme={theme}
        />
        <Routes>
          <Route path="/" element={
            isChildMode
            ? <ChildView user={currentUser} socket={socket} />
            : <ParentView user={currentUser} socket={socket} onSwitchToChild={() => setIsChildMode(true)} onLogout={handleLogout} onSetTheme={setTheme} currentTheme={theme} />
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
