import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Settings, 
  Check, 
  Bell,
  LogOut,
  Sparkles,
  Smile,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, AppNotification } from '../../types';
import { requestNotificationPermission } from '../../lib/notificationHelper';
import { authFetch } from '../../lib/api';

export const Navbar = ({ user, onLogout, isChildMode, onSwitchMode, onSetTheme, currentTheme }: { 
  user: UserProfile | null, 
  onLogout: () => void,
  isChildMode?: boolean,
  onSwitchMode?: () => void,
  onSetTheme?: (theme: string) => void,
  currentTheme?: string
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await authFetch(`/api/notifications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Navbar fetchNotifications error:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const openNotifCenter = async () => {
    setShowNotif(true);
    setShowThemeSelector(false);
    await fetchNotifications();
  };

  const closeNotifCenter = async () => {
    setShowNotif(false);
    if (user && notifications.some(n => !n.isRead)) {
      try {
        await authFetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
      } catch (e) {
        console.error('mark read error:', e);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 z-[100] flex items-center justify-between px-6 lg:px-12">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-light">
          <Star size={24} fill="currentColor" />
        </div>
        <span className="font-sans font-black text-xl tracking-tighter text-gray-900 hidden sm:block">圆滚滚银行</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {onSwitchMode && user?.role === 'parent' && isChildMode && (
          <button 
            onClick={onSwitchMode}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all bg-secondary-light text-secondary-hover hover:opacity-80"
          >
            <Settings size={14} />
            <span className="hidden xs:inline">返回管理模式</span>
          </button>
        )}
        <div className="relative">
          <button 
            onClick={() => { setShowThemeSelector(!showThemeSelector); setShowNotif(false); }}
            className={`p-2 rounded-full transition-colors ${showThemeSelector ? 'bg-brand shadow-lg text-white' : 'text-gray-400 hover:text-brand hover:bg-brand-light'}`}
          >
            <Sparkles size={20} />
          </button>
          <AnimatePresence>
            {showThemeSelector && onSetTheme && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-3xl shadow-2xl p-3 z-50"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">选择配色主题</p>
                  {[
                    { id: 'default', name: '绝绝紫', color: '#4f46e5' },
                    { id: 'ocean', name: '深邃海洋', color: '#0284c7' },
                    { id: 'forest', name: '碧绿森林', color: '#16a34a' },
                    { id: 'sunset', name: '暖阳橙', color: '#ea580c' },
                    { id: 'sakura', name: '樱花粉', color: '#db2777' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => { onSetTheme(t.id); setShowThemeSelector(false); }}
                      className={`flex items-center gap-3 p-2 rounded-2xl transition-all ${currentTheme === t.id ? 'bg-brand-light' : 'hover:bg-gray-50'}`}
                    >
                      <div className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: t.color }} />
                      <span className={`text-xs font-bold ${currentTheme === t.id ? 'text-brand' : 'text-gray-600'}`}>{t.name}</span>
                      {currentTheme === t.id && <Check size={12} className="ml-auto text-brand" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!isChildMode && (
          <div className="relative">
            <button 
              onClick={openNotifCenter}
              className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light rounded-full transition-colors relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] leading-[18px] text-center bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 bg-gray-50 py-1.5 pl-1.5 pr-4 rounded-full border border-gray-100">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-brand shadow-sm font-bold overflow-hidden text-sm">
            {user?.name[0] || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-black text-gray-800 leading-none">{user?.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
              {isChildMode ? '孩子领地' : (user?.role === 'admin' ? '总管端' : '家长端')}
            </p>
          </div>
          <button onClick={onLogout} className="text-gray-400 hover:text-red-500 ml-1 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>

    <AnimatePresence>
      {showNotif && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeNotifCenter} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-gray-900">消息盒子</h2>
              <button onClick={closeNotifCenter} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {('Notification' in window && Notification.permission !== 'granted') && (
                <button 
                  onClick={() => requestNotificationPermission()}
                  className="w-full p-4 bg-brand-light text-brand rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-brand hover:text-white transition-all"
                >
                  <Bell size={16} />
                  开启浏览器通知
                </button>
              )}
              {notifications.filter(n => !n.isRead).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">暂无新消息</p>
              )}
              {notifications.filter(n => !n.isRead).map(notif => (
                <div key={notif.id} className="p-5 rounded-2xl border bg-white border-brand-light shadow-sm">
                  <p className="font-black text-sm text-gray-900 mb-1">{notif.title}</p>
                  <p className="text-sm text-gray-600 font-medium">{notif.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{new Date(notif.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
};
