/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Star, 
  Settings, 
  History, 
  Plus, 
  Check, 
  ChevronRight, 
  Trophy, 
  User, 
  Home, 
  PieChart, 
  Bell,
  LogOut,
  Gift,
  Zap,
  Layout,
  CheckCircle,
  X,
  RotateCw,
  AlertCircle,
  Lock,
  ShieldAlert,
  PartyPopper,
  Sparkles,
  Smile,
  LayoutDashboard,
  Users,
  Trash2,
  Edit2,
  Clock,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { UserProfile, RewardRule, RewardItem, RedemptionRecord, PointHistory, TaskSubmission, AppNotification } from './types';

// --- Components ---

const Navbar = ({ user, socket, onLogout, isChildMode, onSwitchMode, onSetTheme, currentTheme }: { 
  user: UserProfile | null, 
  socket: Socket | null, 
  onLogout: () => void,
  isChildMode?: boolean,
  onSwitchMode?: () => void,
  onSetTheme?: (theme: string) => void,
  currentTheme?: string
}) => {
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.on('points_updated', (data) => {
      setNotifications(prev => [`积分变动通知: ${data.reason}`, ...prev]);
    });
    socket.on('new_redemption', (data) => {
      setNotifications(prev => [`有新的奖励兑换申请: ${data.rewardTitle}`, ...prev]);
    });
    socket.on('new_task_submission', (data) => {
      setNotifications(prev => [`收到新的任务完成申请: ${data.title}`, ...prev]);
    });
    return () => {
      socket.off('points_updated');
      socket.off('new_redemption');
      socket.off('new_task_submission');
    }
  }, [socket]);

  return (
    <nav className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 z-[100] flex items-center justify-between px-6 lg:px-12">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-light">
          <Star size={24} fill="currentColor" />
        </div>
        <span className="font-sans font-black text-xl tracking-tighter text-gray-900 hidden sm:block">圆滚滚银行</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        {onSwitchMode && user?.role === 'parent' && (
          <button 
            onClick={onSwitchMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all ${
              isChildMode 
              ? 'bg-secondary-light text-secondary-hover hover:opacity-80' 
              : 'bg-brand-light text-brand hover:opacity-80'
            }`}
          >
            {isChildMode ? <Settings size={14} /> : <Smile size={14} />}
            <span className="hidden xs:inline">{isChildMode ? '管理模式' : '儿童模式'}</span>
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

        <div className="relative">
          <button 
            onClick={() => { setShowNotif(!showNotif); setShowThemeSelector(false); }}
            className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light rounded-full transition-colors relative"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
          <AnimatePresence>
            {showNotif && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl p-4 z-50"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">通知</h3>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">暂无消息</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <p key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">{n}</p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
  );
};

// --- Super Admin Logic ---

const SuperAdminView = ({ onLogout }: { onLogout: () => void }) => {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchFamilies = async () => {
    try {
      const res = await fetch('/api/admin/families');
      if (!res.ok) {
        const text = await res.text();
        console.error("API Error Response:", text);
        throw new Error(`请求失败 (状态码 ${res.status})`);
      }
      const data = await res.json();
      setFamilies(data);
    } catch (e) {
      console.error("Fetch Families Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFamilies();
  }, []);

  const executeDeleteFamily = async (id: string) => {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/families/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '删除失败');
      }
      fetchFamilies();
      setConfirmDeleteId(null);
    } catch (e) {
      console.error("Delete Family Error:", e);
      setDeleteError(e instanceof Error ? e.message : '删除出错了');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 leading-none">系统总管</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">全局管理中心</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-500 font-bold transition-all">
          <LogOut size={18} />
          退出登录
        </button>
      </nav>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <header className="mb-10">
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">所有家庭概览</h2>
          <p className="text-gray-500 mt-2">当前共管理 {families.length} 个活跃中心家庭</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {families.map(f => (
              <motion.div 
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] border-2 border-transparent hover:border-brand-light shadow-sm hover:shadow-xl transition-all overflow-hidden group"
              >
                <div className="bg-brand-light p-8 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-brand shadow-sm">
                      <Users size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 leading-tight">{f.name}</h3>
                      <p className="text-xs font-bold text-brand-light uppercase tracking-widest mt-1">家庭 ID: {f.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setConfirmDeleteId(f.id)}
                    className="w-10 h-10 bg-white/50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Calendar size={12} />
                        注册时间
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '未知'}
                      </span>
                    </div>
                    <div className="w-px h-8 bg-gray-200"></div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-brand uppercase tracking-widest">
                        <Clock size={12} />
                        最后活跃
                      </div>
                      <span className="text-xs font-bold text-gray-700">
                        {f.lastActiveAt ? new Date(f.lastActiveAt).toLocaleString() : '未知'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">家长账号</h4>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {f.parents.map((p: any) => (
                        <div key={p.id} className="bg-brand-light/30 rounded-full px-3 py-1 flex items-center gap-2 border border-brand/10">
                          <User size={12} className="text-brand" />
                          <span className="text-xs font-black text-brand">{p.name}</span>
                        </div>
                      ))}
                      {f.parents.length === 0 && (
                        <span className="text-xs text-gray-400 italic">暂无家长</span>
                      )}
                    </div>

                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">关联小朋友</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {f.children.map((c: any) => (
                        <div key={c.id} className="bg-gray-50 rounded-2xl p-4 flex flex-col items-center gap-2 border border-gray-100">
                          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-brand-light shadow-sm">
                            <User size={16} />
                          </div>
                          <span className="text-xs font-black text-gray-700">{c.name}</span>
                          <span className="text-[10px] font-bold text-secondary flex items-center gap-1">
                            <Star size={10} fill="currentColor" /> {c.points}
                          </span>
                        </div>
                      ))}
                      {f.children.length === 0 && (
                        <p className="col-span-full text-center text-xs text-gray-400 py-2 italic font-medium">还没有小朋友</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-gray-50 flex items-center justify-center text-[10px] font-bold text-brand-light/30">
                           {i}
                         </div>
                       ))}
                    </div>
                    <span className="text-xs font-bold text-gray-400">活跃度: 优秀</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 text-center mb-2">删除这个家庭？</h3>
            <p className="text-sm font-bold text-gray-500 text-center mb-2">这个操作是不可逆的。</p>
            <p className="text-xs text-gray-400 text-center mb-6">所有相关的用户、规则、奖励记录都将被永久清除。</p>
            
            {deleteError && (
              <div className="bg-red-50 text-red-500 p-3 rounded-xl text-center text-xs font-bold mb-6">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                className="flex-1 bg-gray-100 text-gray-500 font-bold py-4 rounded-2xl hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => executeDeleteFamily(confirmDeleteId)}
                className="flex-1 bg-red-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
              >
                彻底删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// --- Parent Logic ---

const ParentView = ({ user, socket, onSwitchToChild, onLogout, onSetTheme, currentTheme }: { 
  user: UserProfile, 
  socket: Socket | null,
  onSwitchToChild: () => void,
  onLogout: () => void,
  onSetTheme: (theme: string) => void,
  currentTheme: string
}) => {
  const [activeTab, setActiveTab ] = useState('dashboard');
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [records, setRecords] = useState<RedemptionRecord[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [pendingTasks, setPendingTasks] = useState<TaskSubmission[]>([]);
  const [showAddReward, setShowAddReward] = useState(false);
  const [newReward, setNewReward] = useState({ title: '', pointsRequired: 50, targetChildId: 'all' });
  const [editingReward, setEditingReward] = useState<RewardItem | null>(null);

  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ title: '', points: 10, description: '', isRepeating: true, targetChildId: 'all' });
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null);
  const [taskToReject, setTaskToReject] = useState<TaskSubmission | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildPassword, setNewChildPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'child' | 'parent'>('child');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changedPassword, setChangedPassword] = useState('');
  const [memberToDelete, setMemberToDelete] = useState<UserProfile | null>(null);
  
  const [profileName, setProfileName] = useState(user.name);
  const [profilePassword, setProfilePassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const child = children.find(c => c.id === selectedChildId) || null;

  const addReward = async () => {
    const id = Math.random().toString(36).substr(2, 9);
    await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newReward, id, parentId: user.id })
    });
    setNewReward({ title: '', pointsRequired: 50, targetChildId: 'all' });
    setShowAddReward(false);
    fetchData();
  };

  const updateReward = async () => {
    if (!editingReward) return;
    await fetch(`/api/rewards/${editingReward.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingReward)
    });
    setEditingReward(null);
    fetchData();
    if (socket) socket.emit('update_data', { parentId: user.id });
  };

  const deleteReward = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个愿望吗？')) return;
    await fetch(`/api/rewards/${id}`, { method: 'DELETE' });
    fetchData();
    if (socket) socket.emit('update_data', { parentId: user.id });
  };

  const fetchData = async () => {
    try {
      const resUsers = await fetch('/api/users');
      if (!resUsers.ok) throw new Error(`Users API: ${resUsers.status}`);
      const allUsers = await resUsers.json();
      
      const members = allUsers.filter((u: UserProfile) => u.familyId === user.familyId);
      const myChildren = members.filter((u: UserProfile) => u.role === 'child');
      setChildren(myChildren);
      setFamilyMembers(members);
      
      if (myChildren.length > 0 && !selectedChildId) {
        setSelectedChildId(myChildren[0].id);
      }

      const activeChild = myChildren.find((c: UserProfile) => c.id === (selectedChildId || (myChildren[0]?.id)));

      const [resRules, resRecords, resRewards, resTasks] = await Promise.all([
        fetch(`/api/rules/${user.id}`),
        fetch(`/api/redemptions/${user.id}`),
        fetch(`/api/rewards/${user.id}`),
        fetch(`/api/tasks/pending/${user.id}`)
      ]);

      if (!resRules.ok || !resRecords.ok || !resRewards.ok || !resTasks.ok) {
        throw new Error("One or more dashboard APIs failed");
      }

      setRules(await resRules.json());
      setRecords(await resRecords.json());
      setRewards(await resRewards.json());
      setPendingTasks(await resTasks.json());

      if (activeChild) {
        const resStats = await fetch(`/api/stats/${activeChild.id}`);
        if (resStats.ok) {
          setStats(await resStats.json());
        }
      }
    } catch (error) {
      console.error("Parent fetchData Error:", error);
      // Optional: Add a small delay and retry once if it's a network error
    }
  };

  const addMember = async () => {
    if (!newChildName.trim()) return;
    await fetch('/api/users/add-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newChildName, 
        parentId: user.id, 
        password: newChildPassword,
        role: newMemberRole
      })
    });
    setNewChildName('');
    setNewChildPassword('');
    setNewMemberRole('child');
    setShowAddChild(false);
    fetchData();
  };

  const updateChildPassword = async () => {
    if (!selectedChildId || !changedPassword.trim()) return;
    await fetch('/api/users/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedChildId, newPassword: changedPassword })
    });
    setChangedPassword('');
    setShowChangePassword(false);
    alert('密码设置成功！');
  };

  const updateProfile = async () => {
    if (!profileName.trim()) return;
    setIsUpdatingProfile(true);
    try {
      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          name: profileName, 
          password: profilePassword || undefined 
        })
      });
      if (!res.ok) throw new Error();
      alert('资料更新成功！下次登录时生效。');
      setProfilePassword('');
    } catch (e) {
      alert('更新失败');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const executeDeleteMember = async () => {
    if (!memberToDelete) return;
    try {
      const res = await fetch(`/api/users/${memberToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || '删除失败');
      }
      
      if (selectedChildId === memberToDelete.id) setSelectedChildId(null);
      fetchData();
      if (socket) socket.emit('update_data', { parentId: user.id });
      setMemberToDelete(null);
    } catch (e) {
      console.error("Delete Member Error:", e);
      alert(e instanceof Error ? e.message : '删除失败，请稍后重试');
    }
  };

  const addRule = async () => {
    const id = Math.random().toString(36).substr(2, 9);
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRule, id, parentId: user.id })
    });
    setNewRule({ title: '', points: 10, description: '', isRepeating: true, targetChildId: 'all' });
    setShowAddRule(false);
    fetchData();
  };

  const updateRule = async () => {
    if (!editingRule) return;
    await fetch(`/api/rules/${editingRule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingRule)
    });
    setEditingRule(null);
    fetchData();
    if (socket) socket.emit('update_data', { parentId: user.id });
  };

  const deleteRule = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个规则吗？小朋友将无法再申请此任务。')) return;
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    fetchData();
    if (socket) socket.emit('update_data', { parentId: user.id });
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedChildId]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchData();
    socket.on('new_task_submission', handleUpdate);
    socket.on('new_redemption', handleUpdate);
    return () => {
      socket.off('new_task_submission', handleUpdate);
      socket.off('new_redemption', handleUpdate);
    };
  }, [socket]);

  const awardPointsDirectly = async (rule: RewardRule) => {
    if (!child) return;
    await fetch('/api/points/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        childId: child.id, 
        amount: rule.points, 
        reason: rule.title 
      })
    });
    fetchData();
  };

  const approveTask = async (task: TaskSubmission) => {
    await fetch('/api/tasks/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: task.id, 
        childId: task.childId, 
        points: task.points, 
        title: task.title.replace(' (申请确认)', '') 
      })
    });
    fetchData();
  };

  const rejectTask = async (task: TaskSubmission) => {
    if (!rejectionReasonInput) {
      setTaskToReject(task);
      return;
    }
    
    await fetch('/api/tasks/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: task.id, 
        childId: task.childId, 
        title: task.title.replace(' (申请确认)', ''),
        rejectionReason: rejectionReasonInput
      })
    });
    setTaskToReject(null);
    setRejectionReasonInput('');
    fetchData();
  };

  const approveRedemption = async (record: RedemptionRecord) => {
    // Correctly get the cost from the rewards list or record
    const targetReward = rewards.find(r => r.id === record.rewardId);
    const pointsCost = targetReward ? targetReward.pointsRequired : 0;
    
    await fetch('/api/redemptions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: record.id, 
        childId: record.childId, 
        rewardId: record.rewardId, 
        pointsCost,
        rewardTitle: record.rewardTitle
      })
    });
    fetchData();
  };

  return (
    <div className="pt-24 pb-32 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block lg:col-span-3 space-y-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-4 px-2">成员切换</h2>
            <div className="space-y-2">
              {familyMembers.filter(m => m.role === 'child').map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChildId(c.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${
                    selectedChildId === c.id 
                    ? 'bg-secondary-light border-2 border-secondary shadow-sm' 
                    : 'bg-gray-50 border-2 border-transparent grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedChildId === c.id ? 'bg-secondary text-white' : 'bg-gray-200 text-gray-400'}`}>
                      <Smile size={20} />
                    </div>
                    <span className={`font-black text-sm ${selectedChildId === c.id ? 'text-secondary-hover' : 'text-gray-500'}`}>{c.name}</span>
                  </div>
                  {selectedChildId === c.id && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-secondary-hover leading-none">{c.points}</span>
                      <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">星币</span>
                    </div>
                  )}
                </button>
              ))}
              <button 
                onClick={() => setShowAddChild(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-gray-100 text-gray-400 hover:border-brand-light hover:text-brand transition-all text-xs font-bold"
              >
                <Plus size={16} />
                添加新成员
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-50">
            <h2 className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-4 px-2">管理控制台</h2>
            <div className="space-y-1">
              {[
                { id: 'dashboard', label: '仪表盘', icon: Layout },
                { id: 'task_approval', label: '加分确认', icon: CheckCircle },
                { id: 'rules', label: '加分规则', icon: Zap },
                { id: 'rewards_manage', label: '愿望清单', icon: Gift },
                { id: 'redemptions', label: '兑换审批', icon: Check },
                { id: 'analysis', label: '数据分析', icon: PieChart },
                { id: 'family_manage', label: '家庭及成员', icon: Settings }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                    activeTab === item.id 
                    ? 'bg-brand text-white shadow-lg shadow-brand-light' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-brand'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="font-bold text-sm">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="pt-4 mt-2">
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-400 hover:bg-red-50 transition-all font-bold text-sm"
            >
              <LogOut size={18} />
              退出账号
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-9">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <h1 className="text-4xl font-black text-gray-900 tracking-tighter">你好, {user.name} 👋</h1>
                  <p className="text-gray-500 mt-2 font-medium">今天也请多多鼓励孩子们吧！</p>
                </div>
              </header>

              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm overflow-hidden relative">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800">直接加分</h3>
                      <button onClick={() => setActiveTab('rules')} className="text-xs text-brand font-bold hover:underline">管理规则</button>
                   </div>
                   <div className="space-y-3">
                      {rules.slice(0, 3).map(rule => (
                        <button 
                          key={rule.id}
                          onClick={() => awardPointsDirectly(rule)}
                          className="w-full flex items-center justify-between p-3 rounded-2xl border border-gray-50 hover:border-brand-light hover:bg-brand-light/30 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-brand transition-colors">
                               <Plus size={18} />
                             </div>
                             <span className="font-semibold text-sm text-gray-700">{rule.title}</span>
                          </div>
                          <span className="font-bold text-brand">+{rule.points}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800">待确认任务 ({pendingTasks.length})</h3>
                      <button onClick={() => setActiveTab('task_approval')} className="text-xs text-brand font-bold hover:underline">查看全部</button>
                   </div>
                   <div className="space-y-3">
                      {pendingTasks.slice(0, 3).map(task => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-2xl bg-brand-light/50 border border-brand-light/50">
                          <div>
                            <p className="font-semibold text-sm text-brand-hover">{task.title}</p>
                            <p className="text-[10px] font-bold text-brand-hover/70">{child?.name} 申请加分</p>
                          </div>
                          <button 
                            onClick={() => approveTask(task)}
                            className="bg-brand hover:bg-brand-hover text-white p-2 rounded-xl shadow-md shadow-brand-light transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ))}
                      {pendingTasks.length === 0 && (
                        <div className="h-32 flex flex-col items-center justify-center text-center">
                          <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-2">
                             <Layout size={20} />
                          </div>
                          <p className="text-xs text-gray-400 font-medium">暂无待确认任务</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                   <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800">待处理兑换 ({records.filter(r => r.status === 'pending').length})</h3>
                      <button onClick={() => setActiveTab('redemptions')} className="text-xs text-brand font-bold hover:underline">去审批</button>
                   </div>
                   <div className="space-y-3">
                      {records.filter(r => r.status === 'pending').slice(0, 3).map(record => (
                        <div key={record.id} className="flex items-center justify-between p-3 rounded-2xl bg-secondary-light/50 border border-secondary/20">
                          <div>
                            <p className="font-semibold text-sm text-secondary-hover">{record.rewardTitle}</p>
                            <p className="text-[10px] font-bold text-secondary-hover/70">{child?.name} 发起</p>
                          </div>
                          <button 
                            onClick={() => approveRedemption(record)}
                            className="bg-secondary hover:bg-secondary-hover text-white p-2 rounded-xl shadow-md shadow-secondary-light transition-colors"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ))}
                      {records.filter(r => r.status === 'pending').length === 0 && (
                        <div className="h-32 flex flex-col items-center justify-center text-center">
                          <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-2">
                             <Check size={20} />
                          </div>
                          <p className="text-xs text-gray-400 font-medium">暂无待处理申请</p>
                        </div>
                      )}
                   </div>
                </div>
              </section>

            </motion.div>
          )}

          {activeTab === 'rewards_manage' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-gray-900">
               <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">奖励项目管理</h1>
                  <button 
                    onClick={() => setShowAddReward(true)}
                    className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-brand-light hover:bg-brand-hover transition-colors"
                  >
                    <Plus size={20} />
                    <span>添加奖励</span>
                  </button>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rewards.map(item => (
                    <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-brand-light text-brand rounded-2xl flex items-center justify-center flex-shrink-0">
                             <Gift size={32} />
                          </div>
                          <div>
                             <p className="font-bold text-gray-800 flex items-center gap-2">
                               {item.title}
                               {item.targetChildId && item.targetChildId !== 'all' && (
                                 <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                                   仅限 {children.find(c => c.id === item.targetChildId)?.name || '未知孩子'}
                                 </span>
                               )}
                             </p>
                             <p className="text-xs text-brand font-bold mt-1">需 {item.pointsRequired} 星币</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <button onClick={() => setEditingReward(item)} className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light rounded-xl transition-colors">
                             <Edit2 size={18} />
                          </button>
                          <button onClick={(e) => deleteReward(item.id, e)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                             <Trash2 size={18} />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>

               <AnimatePresence>
                {showAddReward && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddReward(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
                      <h2 className="text-2xl font-black mb-6 text-gray-900">新建奖励项目</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">奖励名称</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" 
                            placeholder="如：半小时平板时间"
                            value={newReward.title}
                            onChange={(e) => setNewReward({...newReward, title: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">所需星币</label>
                          <input 
                            type="number" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand"
                            value={newReward.pointsRequired}
                            onChange={(e) => setNewReward({...newReward, pointsRequired: parseInt(e.target.value)})}
                          />
                        </div>
                        {children.length > 1 && (
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">专属适用范围</label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setNewReward({...newReward, targetChildId: 'all'})}
                                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                  (newReward.targetChildId || 'all') === 'all' 
                                  ? 'bg-brand-light border-brand text-brand shadow-sm' 
                                  : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <Users size={16} />
                                <span>全家通用</span>
                              </button>
                              {children.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => setNewReward({...newReward, targetChildId: c.id})}
                                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                    newReward.targetChildId === c.id 
                                    ? 'bg-purple-50 border-purple-400 text-purple-600 shadow-sm' 
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                  }`}
                                >
                                  <Smile size={16} />
                                  <span>仅限 {c.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={addReward}
                          className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4"
                        >
                          确认添加
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
               </AnimatePresence>

               {/* Edit Reward Modal */}
               <AnimatePresence>
                {editingReward && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingReward(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
                      <h2 className="text-2xl font-black mb-6 text-gray-900">编辑奖励项目</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">奖励名称</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" 
                            placeholder="如：半小时平板时间"
                            value={editingReward.title}
                            onChange={(e) => setEditingReward({...editingReward, title: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">所需星币</label>
                          <input 
                            type="number" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand"
                            value={editingReward.pointsRequired}
                            onChange={(e) => setEditingReward({...editingReward, pointsRequired: parseInt(e.target.value)})}
                          />
                        </div>
                        {children.length > 1 && (
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">专属适用范围</label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setEditingReward({...editingReward, targetChildId: 'all'})}
                                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                  (editingReward.targetChildId || 'all') === 'all' 
                                  ? 'bg-brand-light border-brand text-brand shadow-sm' 
                                  : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <Users size={16} />
                                <span>全家通用</span>
                              </button>
                              {children.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => setEditingReward({...editingReward, targetChildId: c.id})}
                                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                    editingReward.targetChildId === c.id 
                                    ? 'bg-purple-50 border-purple-400 text-purple-600 shadow-sm' 
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                  }`}
                                >
                                  <Smile size={16} />
                                  <span>仅限 {c.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={updateReward}
                          className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4"
                        >
                          确认修改
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
               </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'analysis' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">积分趋势分析</h1>
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="var(--color-brand)" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: 'var(--color-brand)', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {activeTab === 'family_manage' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
               <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">家庭及成员</h1>
                    <p className="text-gray-500 font-medium">管理您的家庭信息与成员设置</p>
                  </div>
               </div>

               {/* Section: App Settings / Themes */}
               <section className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Sparkles size={14} className="text-brand" />
                    界面主题设定
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                    {[
                      { id: 'default', name: '绝绝紫', color: '#4f46e5' },
                      { id: 'ocean', name: '深邃海洋', color: '#0284c7' },
                      { id: 'forest', name: '碧绿森林', color: '#16a34a' },
                      { id: 'sunset', name: '暖阳橙', color: '#ea580c' },
                      { id: 'sakura', name: '樱花粉', color: '#db2777' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => onSetTheme(t.id)}
                        className={`group relative flex flex-col items-center gap-3 p-4 rounded-3xl transition-all ${
                          currentTheme === t.id 
                          ? 'bg-brand-light border-2 border-brand shadow-md scale-105' 
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <div 
                          className="w-12 h-12 rounded-full shadow-inner transition-transform group-hover:scale-110" 
                          style={{ backgroundColor: t.color }}
                        />
                        <span className={`text-sm font-black transition-colors ${currentTheme === t.id ? 'text-brand' : 'text-gray-600'}`}>
                          {t.name}
                        </span>
                        {currentTheme === t.id && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center shadow-lg">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
               </section>

               {/* Section: Your Account */}
               <section className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
                  <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <User size={14} className="text-brand" />
                    我的账号设置
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">显示名称</label>
                      <input 
                        type="text" 
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 focus:ring-2 focus:ring-brand"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">修改密码 (留空则不修改)</label>
                      <input 
                        type="password" 
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 focus:ring-2 focus:ring-brand"
                        placeholder="请输入新密码"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-8 pt-8 border-t border-gray-50">
                    <button 
                      onClick={updateProfile}
                      disabled={isUpdatingProfile}
                        className="px-8 py-4 bg-brand text-white rounded-2xl font-black shadow-lg shadow-brand-light hover:bg-brand-hover transition-all disabled:opacity-50"
                    >
                      {isUpdatingProfile ? '正在保存...' : '保存修改'}
                    </button>
                  </div>
               </section>

               {/* Section: Children List */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Smile size={14} className="text-secondary" />
                      家庭成员 (小朋友)
                    </h2>
                    <button 
                      onClick={() => setShowAddChild(true)}
                      className="text-xs font-black text-brand hover:bg-brand-light px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                    >
                      <Plus size={14} />
                      添加成员
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {familyMembers.map(m => (
                      <div key={m.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${m.role === 'parent' ? 'bg-brand-light text-brand' : 'bg-secondary-light text-secondary'}`}>
                            {m.role === 'parent' ? <User size={32} /> : <Smile size={32} />}
                          </div>
                          <div>
                            <p className="text-xl font-black text-gray-900">{m.name}{m.id === user.id ? ' (我)' : ''}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${m.role === 'parent' ? 'bg-brand-light text-brand' : 'bg-secondary-light text-secondary'}`}>
                                {m.role === 'parent' ? '家长' : '小朋友'}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">ID: {m.name}@{user.familyId}</span>
                            </div>
                          </div>
                        </div>
                        {m.id !== user.id && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => { setSelectedChildId(m.id); setShowChangePassword(true); }}
                              className="w-10 h-10 bg-gray-50 text-gray-400 hover:bg-brand-light hover:text-brand rounded-xl flex items-center justify-center transition-all"
                              title="设置密码"
                            >
                              <Lock size={18} />
                            </button>
                            <button 
                              onClick={() => setMemberToDelete(m)}
                              className="w-10 h-10 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl flex items-center justify-center transition-all"
                              title="删除成员"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
               </section>
            </motion.div>
          )}

          {activeTab === 'task_approval' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
               <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">加分确认与管理</h1>
                  <button 
                    onClick={() => fetchData()}
                    className="flex items-center gap-2 text-brand font-bold hover:bg-brand-light px-4 py-2 rounded-xl transition-colors"
                  >
                    <RotateCw size={18} />
                    <span>刷新列表</span>
                  </button>
               </div>
               {pendingTasks.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4">
                    {pendingTasks.map(task => (
                      <div key={task.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between">
                         <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-brand-light text-brand rounded-2xl flex items-center justify-center">
                               <Zap size={28} />
                            </div>
                            <div>
                               <p className="text-xl font-bold text-gray-900">{task.title}</p>
                               <div className="flex items-center gap-3 mt-1">
                                 <span className="text-xs font-black text-brand bg-brand-light px-2 py-0.5 rounded">+{task.points} 星币</span>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{child?.name}</span>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">
                                    {new Date(task.timestamp).toLocaleString()}
                                  </span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <button 
                              onClick={() => rejectTask(task)}
                              className="w-12 h-12 rounded-2xl border-2 border-red-50 text-red-400 hover:bg-red-50 transition-colors flex items-center justify-center"
                            >
                              <X size={24} />
                            </button>
                            <button 
                              onClick={() => approveTask(task)}
                              className="bg-brand text-white px-6 h-12 rounded-2xl font-black text-lg shadow-lg shadow-brand-light hover:bg-brand-hover transition-colors"
                            >
                              确认通过
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="text-center py-24 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100">
                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-200">
                       <Check size={32} />
                    </div>
                    <p className="text-gray-400 font-bold">没有待处理的任务加分申请</p>
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'rules' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-gray-900">
               <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">奖励规则管理</h1>
                  <button 
                    onClick={() => setShowAddRule(true)}
                    className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-2xl font-bold shadow-lg shadow-brand-light hover:bg-brand-hover transition-colors"
                  >
                    <Plus size={20} />
                    <span>添加新规则</span>
                  </button>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-900">
                  {rules.map(rule => (
                    <div key={rule.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-brand-light text-brand rounded-2xl flex items-center justify-center">
                              <Zap size={24} />
                           </div>
                           <div>
                              <p className="font-bold text-gray-800">{rule.title}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-brand bg-brand-light px-2 py-0.5 rounded">+{rule.points} 星币</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.isRepeating ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                  {rule.isRepeating ? '日常规则' : '特别加分'}
                                </span>
                                {rule.targetChildId && rule.targetChildId !== 'all' && (
                                   <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                                     仅限 {children.find(c => c.id === rule.targetChildId)?.name || '未知孩子'}
                                   </span>
                                )}
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => setEditingRule(rule)} className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light rounded-xl transition-colors">
                              <Edit2 size={18} />
                           </button>
                           <button onClick={(e) => deleteRule(rule.id, e)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <Trash2 size={18} />
                           </button>
                        </div>
                    </div>
                  ))}
               </div>

               {/* Add Rule Modal */}
               <AnimatePresence>
                {showAddRule && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddRule(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
                      <h2 className="text-2xl font-black mb-6">新建任务规则</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">任务名称</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold focus:ring-2 focus:ring-brand text-gray-900" 
                            placeholder="如：自己刷牙"
                            value={newRule.title}
                            onChange={(e) => setNewRule({...newRule, title: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">奖励数值 (星币)</label>
                          <input 
                            type="number" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold focus:ring-2 focus:ring-brand text-gray-900"
                            value={newRule.points}
                            onChange={(e) => setNewRule({...newRule, points: parseInt(e.target.value)})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1 px-1">任务性质</label>
                          <div className="grid grid-cols-2 gap-3 p-1 bg-gray-50 rounded-2xl">
                             <button
                               onClick={() => setNewRule({ ...newRule, isRepeating: true })}
                               className={`py-3 rounded-xl text-xs font-bold transition-all ${newRule.isRepeating ? 'bg-white shadow-sm text-brand' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                               日常习惯 (可重复)
                             </button>
                             <button
                               onClick={() => setNewRule({ ...newRule, isRepeating: false })}
                               className={`py-3 rounded-xl text-xs font-bold transition-all ${!newRule.isRepeating ? 'bg-white shadow-sm text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                               特别表现 (一次性)
                             </button>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2 px-1">
                            {newRule.isRepeating ? '💡 这类任务适合每天都要做的习惯，完成后还可以继续领。' : '💡 这类任务完成后就会从列表消失，适合偶尔的特别奖励。'}
                          </p>
                        </div>
                        {children.length > 1 && (
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">专属适用范围</label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setNewRule({...newRule, targetChildId: 'all'})}
                                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                  (newRule.targetChildId || 'all') === 'all' 
                                  ? 'bg-brand-light border-brand text-brand shadow-sm' 
                                  : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <Users size={16} />
                                <span>全家通用</span>
                              </button>
                              {children.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => setNewRule({...newRule, targetChildId: c.id})}
                                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                    newRule.targetChildId === c.id 
                                    ? 'bg-purple-50 border-purple-400 text-purple-600 shadow-sm' 
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                  }`}
                                >
                                  <Smile size={16} />
                                  <span>仅限 {c.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={addRule}
                          className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4"
                        >
                          确认添加
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
               </AnimatePresence>

               {/* Edit Rule Modal */}
               <AnimatePresence>
                {editingRule && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingRule(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
                      <h2 className="text-2xl font-black mb-6">修改任务规则</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">任务名称</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold focus:ring-2 focus:ring-brand text-gray-900" 
                            placeholder="如：自己刷牙"
                            value={editingRule.title}
                            onChange={(e) => setEditingRule({...editingRule, title: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">奖励数值 (星币)</label>
                          <input 
                            type="number" 
                            className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold focus:ring-2 focus:ring-brand text-gray-900"
                            value={editingRule.points}
                            onChange={(e) => setEditingRule({...editingRule, points: parseInt(e.target.value)})}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1 px-1">任务性质</label>
                          <div className="grid grid-cols-2 gap-3 p-1 bg-gray-50 rounded-2xl">
                             <button
                               onClick={() => setEditingRule({ ...editingRule, isRepeating: true })}
                               className={`py-3 rounded-xl text-xs font-bold transition-all ${editingRule.isRepeating ? 'bg-white shadow-sm text-brand' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                               日常习惯 (可重复)
                             </button>
                             <button
                               onClick={() => setEditingRule({ ...editingRule, isRepeating: false })}
                               className={`py-3 rounded-xl text-xs font-bold transition-all ${!editingRule.isRepeating ? 'bg-white shadow-sm text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                               特别表现 (一次性)
                             </button>
                          </div>
                        </div>
                        {children.length > 1 && (
                          <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">专属适用范围</label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setEditingRule({...editingRule, targetChildId: 'all'})}
                                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                  (editingRule.targetChildId || 'all') === 'all' 
                                  ? 'bg-brand-light border-brand text-brand shadow-sm' 
                                  : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <Users size={16} />
                                <span>全家通用</span>
                              </button>
                              {children.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => setEditingRule({...editingRule, targetChildId: c.id})}
                                  className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                                    editingRule.targetChildId === c.id 
                                    ? 'bg-purple-50 border-purple-400 text-purple-600 shadow-sm' 
                                    : 'bg-gray-50 border-transparent text-gray-400 hover:text-gray-600'
                                  }`}
                                >
                                  <Smile size={16} />
                                  <span>仅限 {c.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={updateRule}
                          className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4"
                        >
                          确认修改
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
               </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'redemptions' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">愿望兑换审批</h1>
                  <button 
                    onClick={() => fetchData()}
                    className="flex items-center gap-2 text-brand font-bold hover:bg-brand-light px-4 py-2 rounded-xl transition-colors"
                  >
                    <RotateCw size={18} />
                    <span>刷新</span>
                  </button>
               </div>

               {/* Section 1: Pending Redemptions */}
               <section className="space-y-4">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                    待处理申请
                  </h2>
                  {records.filter(r => r.status === 'pending').length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                       {records.filter(r => r.status === 'pending').map(record => {
                         const reward = rewards.find(rw => rw.id === record.rewardId);
                         return (
                           <div key={record.id} className="bg-white p-6 rounded-[2.5rem] border-2 border-secondary-light shadow-sm flex items-center justify-between">
                              <div className="flex items-center gap-5">
                                 <div className="w-14 h-14 bg-secondary-light text-secondary rounded-2xl flex items-center justify-center">
                                    <Gift size={28} />
                                 </div>
                                 <div>
                                    <p className="text-xl font-bold text-gray-900">{record.rewardTitle}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                       <span className="text-xs font-black text-secondary bg-secondary-light px-2 py-0.5 rounded">
                                         需 {reward?.pointsRequired || '?'} 星币
                                       </span>
                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{child?.name} 的申请</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <button 
                                   onClick={() => approveRedemption(record)}
                                   disabled={child && child.points < (reward?.pointsRequired || 0)}
                                   className={`px-8 h-12 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 ${
                                     child && child.points >= (reward?.pointsRequired || 0)
                                     ? 'bg-secondary text-white shadow-secondary-light hover:bg-secondary-hover'
                                     : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                   }`}
                                 >
                                   {child && child.points >= (reward?.pointsRequired || 0) ? '准许兑换' : '积分不足'}
                                 </button>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-gray-400">
                       <p className="font-bold text-sm italic">目前所有愿望都已处理完成啦 ✨</p>
                    </div>
                  )}
               </section>

               {/* Section 2: History */}
               <section className="space-y-4">
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">历史审批记录</h2>
                  <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">时间</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">项目</th>
                            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {records.filter(r => r.status !== 'pending').map(record => (
                            <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(record.timestamp).toLocaleString()}</td>
                              <td className="px-6 py-4 font-semibold text-gray-800">{record.rewardTitle}</td>
                              <td className="px-6 py-4">
                                 <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700">
                                    已通过
                                 </span>
                              </td>
                            </tr>
                          ))}
                          {records.filter(r => r.status !== 'pending').length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-6 py-10 text-center text-gray-300 font-bold italic">暂无历史记录</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
               </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showAddChild && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddChild(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-6 text-gray-900">添加小朋友</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">成员身份</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setNewMemberRole('child')}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${newMemberRole === 'child' ? 'bg-brand text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                    >
                      小朋友
                    </button>
                    <button 
                      onClick={() => setNewMemberRole('parent')}
                      className={`py-3 rounded-xl font-bold text-sm transition-all ${newMemberRole === 'parent' ? 'bg-brand text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}
                    >
                      家长/长辈
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">成员名称</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" 
                    placeholder="例如：乐妈"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">初始密码</label>
                  <input 
                    type="password" 
                    className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" 
                    placeholder="默认 123456"
                    value={newChildPassword}
                    onChange={(e) => setNewChildPassword(e.target.value)}
                  />
                </div>
                <button 
                   onClick={addMember}
                   className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4"
                >
                  确认添加成员
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {taskToReject && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setTaskToReject(null); setRejectionReasonInput(''); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2 text-gray-900">不通过申请</h2>
              <p className="text-gray-500 mb-6 font-medium">请填写不通过的原因，帮助小朋友改进哦：</p>
              
              <div className="space-y-4">
                <textarea 
                  autoFocus
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 font-semibold focus:ring-2 focus:ring-red-500 text-gray-900 h-32 resize-none" 
                  placeholder="例如：任务完成度不够，或者需要重新检查一下..."
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                />
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button 
                    onClick={() => { setTaskToReject(null); setRejectionReasonInput(''); }}
                    className="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => rejectTask(taskToReject)}
                    disabled={!rejectionReasonInput.trim()}
                    className={`py-4 rounded-2xl font-black text-white shadow-lg transition-all ${
                      rejectionReasonInput.trim() ? 'bg-red-500 shadow-red-100 hover:bg-red-600' : 'bg-gray-200 cursor-not-allowed shadow-none'
                    }`}
                  >
                    确认不通过
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePassword && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChangePassword(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-2 text-gray-900">修改登录密码</h2>
              <p className="text-gray-500 mb-6 font-medium">正在为 <span className="text-brand font-bold">{child?.name}</span> 设置新密码：</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1 px-2">新密码</label>
                  <input 
                    type="password" 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand" 
                    placeholder="请输入 4-12 位密码"
                    value={changedPassword}
                    onChange={(e) => setChangedPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button 
                    onClick={() => setShowChangePassword(false)}
                    className="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={updateChildPassword}
                    disabled={changedPassword.length < 4}
                    className={`py-4 rounded-2xl font-black text-white shadow-lg transition-all ${
                      changedPassword.length >= 4 ? 'bg-brand shadow-brand-light hover:bg-brand-hover' : 'bg-gray-200 cursor-not-allowed shadow-none'
                    }`}
                  >
                    确认修改
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Member Deletion Confirmation Modal */}
      <AnimatePresence>
        {memberToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMemberToDelete(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full relative z-10 shadow-2xl text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2 text-gray-900">确定要删除吗？</h2>
              <div className="text-gray-500 mb-8 font-medium leading-relaxed">
                正在删除 <span className="text-orange-500 font-bold">{memberToDelete.name}</span>
                {memberToDelete.role === 'child' ? (
                  <div className="mt-2 bg-gray-50 rounded-2xl p-4">
                    <p className="text-sm">该宝宝当前拥有</p>
                    <p className="text-2xl font-black text-brand">{memberToDelete.points} <span className="text-xs font-bold text-gray-400 font-sans tracking-widest uppercase">星币</span></p>
                  </div>
                ) : <span className="text-gray-400"> (家长账号)</span>}
                <p className="text-xs text-red-400 mt-4 px-4 bg-red-50/50 py-2 rounded-lg inline-block border border-red-100">
                  ⚠️ 此操作不可逆，所有数据将被永久删除
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setMemberToDelete(null)}
                  className="py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={executeDeleteMember}
                  className="py-4 rounded-2xl bg-red-500 text-white font-black shadow-lg shadow-red-100 hover:bg-red-600 transition-all"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between z-50">
         {[
          { id: 'dashboard', icon: Layout },
          { id: 'task_approval', icon: CheckCircle },
          { id: 'rules', icon: Zap },
          { id: 'rewards_manage', icon: Gift },
          { id: 'redemptions', icon: Check },
          { id: 'analysis', icon: PieChart },
          { id: 'family_manage', icon: Settings }
        ].map(item => (
          <button 
            key={item.id} 
            onClick={() => setActiveTab(item.id)}
            className={`p-3 rounded-2xl transition-all ${activeTab === item.id ? 'bg-brand text-white shadow-lg shadow-brand-light' : 'text-gray-400'}`}
          >
            <item.icon size={24} />
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Child Logic ---

const ChildView = ({ user, socket }: { user: UserProfile, socket: Socket | null }) => {
  const [activeTab, setActiveTab ] = useState('rewards');
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [rejectedTasks, setRejectedTasks] = useState<TaskSubmission[]>([]);
  const [localPoints, setLocalPoints] = useState(user.points);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebratedReward, setCelebratedReward] = useState<RewardItem | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<TaskSubmission[]>([]);
  const [showPointsIncrease, setShowPointsIncrease] = useState(false);
  const [pointsDiff, setPointsDiff] = useState(0);

  const fetchData = async () => {
    try {
      const [resRewards, resHistory, resUser, resRules, resRejected, resNotifs, resRedemptions, resAllSubs] = await Promise.all([
        fetch(`/api/rewards/${user.parentId}`),
        fetch(`/api/history/${user.id}`),
        fetch(`/api/users/${user.id}`),
        fetch(`/api/rules/${user.parentId}`),
        fetch(`/api/tasks/rejected/${user.id}`),
        fetch(`/api/notifications/${user.id}`),
        fetch(`/api/redemptions/child/${user.id}`),
        fetch(`/api/tasks/all/${user.id}`)
      ]);

      if (!resRewards.ok || !resHistory.ok || !resUser.ok || !resRules.ok || !resRejected.ok || !resNotifs.ok || !resRedemptions.ok || !resAllSubs.ok) {
        throw new Error("One or more child APIs failed");
      }

      const [rewardsData, historyData, userData, rulesData, rejectedData, notifsData, redemptionsData, allSubsData] = await Promise.all([
        resRewards.json(),
        resHistory.json(),
        resUser.json(),
        resRules.json(),
        resRejected.json(),
        resNotifs.json(),
        resRedemptions.json(),
        resAllSubs.json()
      ]);

      setRewards(rewardsData);
      setHistory(historyData);
      setRules(rulesData);
      setRejectedTasks(rejectedData);
      setNotifications(notifsData);
      setRedemptions(redemptionsData);
      setAllSubmissions(allSubsData);
      
      const newPoints = userData.points;
      const cachedPoints = localStorage.getItem(`kiddie_last_points_${user.id}`);
      if (cachedPoints !== null) {
        const lastPoints = parseInt(cachedPoints, 10);
        if (newPoints > lastPoints) {
          setPointsDiff(newPoints - lastPoints);
          setShowPointsIncrease(true);
          setTimeout(() => setShowPointsIncrease(false), 3500);
        }
      }
      localStorage.setItem(`kiddie_last_points_${user.id}`, newPoints.toString());
      setLocalPoints(newPoints);
    } catch (error) {
      console.error("Child fetchData Error:", error);
    }
  };

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      if (rule.isRepeating) return true;
      const hasSubmission = allSubmissions.some(s => s.ruleId === rule.id && s.status !== 'rejected');
      return !hasSubmission;
    });
  }, [rules, allSubmissions]);

  const submitTask = async (rule: RewardRule) => {
    setSubmittingId(rule.id);
    try {
      await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: Math.random().toString(36).substr(2, 9),
          childId: user.id, 
          parentId: user.parentId || 'p1', // Fallback to p1 if undefined
          ruleId: rule.id,
          points: rule.points, 
          title: `${rule.title} (申请确认)` 
        })
      });
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      fetchData();
    } finally {
      setSubmittingId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchData();
    socket.on('task_approved', handleUpdate);
    socket.on('task_rejected', handleUpdate);
    socket.on('new_notification', (data) => {
      if (data.userId === user.id) {
        fetchData();
      }
    });
    return () => {
      socket.off('task_approved', handleUpdate);
      socket.off('task_rejected', handleUpdate);
      socket.off('new_notification');
    };
  }, [socket]);

  const markNotifsRead = async () => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
  };

  const redeem = async (reward: RewardItem) => {
    if (localPoints < reward.pointsRequired) {
      alert('星币不足哦，再努力积累一点吧！加油！');
      return;
    }
    
    // Grand Effect Start
    setCelebratedReward(reward);
    setShowCelebration(true);
    
    try {
      await fetch('/api/redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Math.random().toString(36).substr(2, 9),
          childId: user.id,
          parentId: user.parentId,
          rewardId: reward.id,
          rewardTitle: reward.title
        })
      });
      
      // Trigger a small sound effect if possible
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };
        playTone(523.25, 0, 0.1); // C5
        playTone(659.25, 0.1, 0.1); // E5
        playTone(783.99, 0.2, 0.3); // G5
      } catch (e) { /* ignore audio errors */ }
      
      fetchData();
    } catch (error) {
      alert('兑换出错了，请稍后再试。');
      setShowCelebration(false);
    }
  };

  return (
    <div className="pt-24 pb-32 max-w-4xl mx-auto px-6 space-y-8">
      {/* Header with Welcome and Notification Bell */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">你好呀，{user.name}！</h1>
          <p className="text-gray-500 font-bold flex items-center gap-2">
            <Trophy size={16} className="text-secondary" />
            今天也要继续加油哦！
          </p>
        </div>
        <button 
          onClick={() => { setShowNotifCenter(true); markNotifsRead(); }}
          className="w-16 h-16 bg-white border-2 border-gray-50 rounded-[1.8rem] shadow-sm flex items-center justify-center relative hover:shadow-xl hover:border-brand-light transition-all active:scale-95"
        >
          <Bell size={28} className={notifications.some(n => !n.isRead) ? "text-brand animate-bounce" : "text-gray-400"} />
          {notifications.some(n => !n.isRead) && (
            <span className="absolute top-4 right-4 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg">
              {notifications.filter(n => !n.isRead).length}
            </span>
          )}
        </button>
      </div>

      {/* Header Cards */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-brand text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
          >
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <Check size={16} />
            </div>
            <span>任务已提交，等爸爸妈妈确认哦！</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-brand to-brand-hover rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden"
        >
          {showPointsIncrease && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: -40, scale: 1.2 }}
              exit={{ opacity: 0 }}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-yellow-300 font-black text-4xl flex items-center gap-1 z-50 drop-shadow-xl"
            >
              +{pointsDiff} <Star fill="currentColor" size={32} className="animate-spin-slow" />
            </motion.div>
          )}
          
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-1">我的星币</p>
              <h2 className="text-6xl font-black">{localPoints}</h2>
            </div>
            <div className={`bg-white/20 p-4 rounded-3xl backdrop-blur-sm transition-transform duration-500 ${showPointsIncrease ? 'scale-125 rotate-12 bg-yellow-400/30' : ''}`}>
               <Star size={48} fill="currentColor" className={showPointsIncrease ? 'text-yellow-300' : ''} />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
           <button onClick={() => setActiveTab('rewards')} className={`flex flex-col items-center justify-center rounded-[2rem] border-2 transition-all ${activeTab === 'rewards' ? 'bg-white border-brand shadow-xl shadow-brand-light' : 'bg-gray-50 border-transparent text-gray-400'}`}>
              <Gift size={32} className={activeTab === 'rewards' ? 'text-brand' : ''} />
              <span className="font-black mt-2 text-sm">愿望单</span>
           </button>
           <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center rounded-[2rem] border-2 transition-all ${activeTab === 'history' ? 'bg-white border-brand shadow-xl shadow-brand-light' : 'bg-gray-50 border-transparent text-gray-400'}`}>
              <History size={32} className={activeTab === 'history' ? 'text-brand' : ''} />
              <span className="font-black mt-2 text-sm">成长足迹</span>
           </button>
           <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center justify-center rounded-[2rem] border-2 transition-all ${activeTab === 'tasks' ? 'bg-white border-brand shadow-xl shadow-brand-light' : 'bg-gray-50 border-transparent text-gray-400'}`}>
              <Zap size={32} className={activeTab === 'tasks' ? 'text-brand' : ''} />
              <span className="font-black mt-2 text-sm">做任务</span>
           </button>
        </div>
      </div>

      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'tasks' && (
            <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.map(rule => {
                const ruleSubmissions = allSubmissions.filter(s => s.ruleId === rule.id);
                const pendingSubmission = ruleSubmissions.find(s => s.status === 'pending');
                const latestSubmission = ruleSubmissions.sort((a, b) => b.timestamp - a.timestamp)[0];
                const isRejectedToday = latestSubmission?.status === 'rejected' && new Date(latestSubmission.timestamp).toDateString() === new Date().toDateString();
                const isApprovedToday = ruleSubmissions.some(s => s.status === 'approved' && new Date(s.timestamp).toDateString() === new Date().toDateString());
                const isRuleDisabled = submittingId === rule.id || !!pendingSubmission || isRejectedToday || isApprovedToday;

                return (
                <button 
                   key={rule.id}
                   onClick={() => !isRuleDisabled && submitTask(rule)}
                   disabled={isRuleDisabled}
                   className={`bg-white p-6 rounded-[2rem] border flex items-center justify-between transition-all text-left relative overflow-hidden ${
                     isRuleDisabled ? 'border-gray-100 bg-gray-50/50 cursor-not-allowed opacity-80' : 'border-gray-100 hover:border-brand shadow-sm group'
                   }`}
                >
                   {submittingId === rule.id && (
                     <motion.div 
                       className="absolute bottom-0 left-0 h-1 bg-brand"
                       initial={{ width: 0 }}
                       animate={{ width: "100%" }}
                     />
                   )}
                   <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                        submittingId === rule.id ? 'bg-brand text-white' : 'bg-brand-light text-brand'
                      }`}>
                         <Zap size={24} className={submittingId === rule.id ? 'animate-pulse' : ''} />
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                         <p className="font-black text-gray-900 break-words whitespace-normal leading-snug">{rule.title}</p>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-gray-400 tracking-widest">+ {rule.points} 星币</span>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${rule.isRepeating ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                              {rule.isRepeating ? '日常' : '特别'}
                            </span>
                         </div>
                      </div>
                   </div>
                   <div className={`p-2 rounded-full transition-all ${
                     isRuleDisabled ? 'bg-transparent text-gray-400' : 'bg-gray-50 text-gray-300 group-hover:bg-brand group-hover:text-white'
                   }`}>
                      {submittingId === rule.id ? (
                        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      ) : pendingSubmission ? (
                        <span className="text-xs font-black uppercase tracking-widest bg-gray-200 text-gray-500 px-3 py-1.5 rounded-full whitespace-nowrap">审核中</span>
                      ) : isRejectedToday ? (
                        <span className="text-xs font-black uppercase tracking-widest bg-red-50 text-red-500 px-3 py-1.5 rounded-full whitespace-nowrap">未通过</span>
                      ) : isApprovedToday ? (
                        <span className="text-xs font-black uppercase tracking-widest bg-green-50 text-green-600 px-3 py-1.5 rounded-full whitespace-nowrap border border-green-100">今日已完成</span>
                      ) : (
                        <Check size={20} />
                      )}
                   </div>
                </button>
                );
              })}
              {filteredRules.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-24 h-24 bg-brand-light rounded-[2.5rem] flex items-center justify-center text-brand">
                    <Zap size={48} className="opacity-40" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">太棒了！</h3>
                    <p className="text-gray-500 font-bold mt-1">今天所有的任务都完成了，<br/>或者等爸爸妈妈给你加新任务哦！</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {activeTab === 'rewards' && (
            <motion.div key="rewards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {rewards.map(item => {
                const pendingRecord = redemptions.find(r => r.rewardId === item.id && r.status === 'pending');
                return (
                  <div key={item.id} className="bg-white rounded-[2rem] border border-gray-100 p-6 flex flex-col gap-4 shadow-sm group hover:shadow-xl transition-all duration-300 relative">
                    {pendingRecord && (
                      <div className="absolute top-4 right-4 z-10 bg-secondary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg animate-pulse">
                        审批中
                      </div>
                    )}
                    <div className="w-full aspect-video bg-brand-light text-brand/30 rounded-2xl flex items-center justify-center overflow-hidden">
                       <Gift size={80} className="group-hover:scale-110 group-hover:text-brand/50 transition-all duration-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-gray-900 leading-tight">{item.title}</h3>
                      <div className="flex items-center gap-1 mt-2 text-brand font-black">
                        <Star size={16} fill="currentColor"/>
                        <span>需要 {item.pointsRequired} 星币</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => !pendingRecord && redeem(item)}
                      disabled={localPoints < item.pointsRequired || !!pendingRecord}
                      className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
                        pendingRecord 
                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-2 border-dashed border-gray-100'
                        : localPoints >= item.pointsRequired 
                        ? 'bg-brand text-white shadow-lg shadow-brand-light active:scale-95' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {pendingRecord ? '正在等待审批...' : (localPoints >= item.pointsRequired ? '果断兑换！' : '还缺一点点')}
                    </button>
                  </div>
                );
              })}
              {rewards.length === 0 && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-24 h-24 bg-secondary-light rounded-[2.5rem] flex items-center justify-center text-secondary">
                    <Gift size={48} className="opacity-40" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">愿望单是空的哦</h3>
                    <p className="text-gray-500 font-bold mt-1">快去告诉爸爸妈妈<br/>你想要什么奖励吧！</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
              {rejectedTasks.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={14} /> 
                    需要加油的地方 (爸爸妈妈的建议)
                  </h3>
                  <div className="space-y-3">
                    {rejectedTasks.map(task => (
                      <div key={task.id} className="bg-red-50/50 p-5 rounded-[1.5rem] border border-red-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-red-900">{task.title}</p>
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{new Date(task.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="bg-white/60 p-3 rounded-xl border border-red-50 text-sm text-red-700 italic font-medium">
                          “ {task.rejectionReason} ”
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {history.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                    <div className={`w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center ${item.type === 'earn' ? 'bg-green-50 text-green-600' : 'bg-secondary-light text-secondary'}`}>
                       {item.type === 'earn' ? <Zap size={24} /> : <Gift size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 break-words whitespace-normal leading-snug">{item.reason}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className={`font-black text-xl ${item.type === 'earn' ? 'text-green-600' : 'text-secondary'}`}>
                    {item.type === 'earn' ? '+' : '-'}{item.amount}
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                 <div className="text-center py-20 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <p className="text-gray-400 font-bold">还没有记录哦，快去赚积分吧！</p>
                 </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Message Box (Notification Center) */}
      <AnimatePresence>
        {showNotifCenter && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotifCenter(false)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }} 
               exit={{ scale: 0.9, opacity: 0, y: 20 }} 
               className="bg-white rounded-[3rem] p-8 max-w-md w-full relative z-10 shadow-2xl overflow-hidden"
             >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-light text-brand rounded-2xl flex items-center justify-center">
                       <Bell size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">消息盒子</h2>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">爸爸妈妈的最新反馈</p>
                    </div>
                  </div>
                  <button onClick={() => setShowNotifCenter(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                   {notifications.length > 0 ? (
                     notifications.map(notif => (
                       <div key={notif.id} className={`p-5 rounded-[2rem] border transition-all ${notif.isRead ? 'bg-gray-50/50 border-gray-100 opacity-60' : 'bg-white border-brand-light shadow-sm'}`}>
                          <div className="flex items-center gap-3 mb-2">
                             <div className={`w-2 h-2 rounded-full ${notif.type === 'success' ? 'bg-green-500' : notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                             <p className="font-black text-sm text-gray-900">{notif.title}</p>
                          </div>
                          <p className="text-sm text-gray-600 font-medium leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-3 flex items-center gap-1">
                             <History size={10} />
                             {new Date(notif.timestamp).toLocaleString()}
                          </p>
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-10 opacity-30">
                        <Bell size={48} className="mx-auto mb-4" />
                        <p className="font-black">暂时没有新消息哦</p>
                     </div>
                   )}
                </div>

                <button 
                  onClick={() => setShowNotifCenter(false)}
                  className="w-full mt-8 bg-brand text-white py-4 rounded-[1.8rem] font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover transition-all active:scale-95"
                >
                  知道啦
                </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Celebration Modal for Reward Redemption */}
      <AnimatePresence>
        {showCelebration && celebratedReward && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-brand/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 100, rotate: -10 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.5, y: 100, opacity: 0 }}
              className="relative bg-white rounded-[4rem] p-12 max-w-lg w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
            >
              <div className="absolute -top-20 left-1/2 -translate-x-1/2">
                <motion.div 
                  animate={{ 
                    rotate: [0, -10, 10, -10, 10, 0],
                    scale: [1, 1.2, 1, 1.2, 1]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-40 h-40 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center text-brand"
                >
                  <PartyPopper size={80} />
                </motion.div>
              </div>

              {/* Decorative elements */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0, 1.5, 0.5],
                    x: (Math.random() - 0.5) * 400,
                    y: (Math.random() - 0.5) * 400,
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                  className="absolute pointer-events-none"
                  style={{ top: '50%', left: '50%' }}
                >
                  <Sparkles className="text-yellow-400" size={24 + Math.random() * 20} />
                </motion.div>
              ))}

              <div className="mt-16 space-y-6">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 mb-2 leading-tight">哇！太棒了！</h2>
                  <p className="text-brand font-black text-xl">成功兑换了新愿望</p>
                </div>

                <div className="bg-gray-50 border-2 border-gray-100 rounded-[2.5rem] p-6 text-left flex items-center gap-5">
                   <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center text-brand overflow-hidden shrink-0">
                      <Gift size={40} className="opacity-80" />
                   </div>
                   <div>
                      <p className="font-black text-gray-900 text-xl">{celebratedReward.title}</p>
                      <p className="text-sm font-bold text-gray-400 flex items-center gap-1 uppercase tracking-widest mt-1">
                        消耗 {celebratedReward.pointsRequired} 星币
                      </p>
                   </div>
                </div>

                <div className="text-gray-500 font-bold leading-relaxed px-4">
                  兑换申请已经像小火箭一样飞向爸爸妈妈啦！请耐心等待他们的确认通知哦～
                </div>

                <button 
                  onClick={() => setShowCelebration(false)}
                  className="w-full bg-brand text-white py-6 rounded-[2.2rem] font-black text-2xl shadow-2xl shadow-brand-light hover:bg-brand-hover transition-all active:scale-95 group overflow-hidden relative"
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    知道啦，真开心！
                  </span>
                  <motion.div 
                    className="absolute inset-0 bg-white/20"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Landing/Login ---

const LoginView = ({ onLogin }: { onLogin: (u: UserProfile) => void }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  
  // Registration state
  const [regFamilyName, setRegFamilyName] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.user);
      } else {
        setError(data.message || '登录失败，请检查用户名和密码');
      }
    } catch (err) {
      setError('登录出错了，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFamilyName || !regAdminName || !regPassword) return;
    setLoading(true);
    try {
      const res = await fetch('/api/register/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          familyName: regFamilyName, 
          adminName: regAdminName, 
          password: regPassword 
        })
      });
      const data = await res.json();
      if (data.success) {
        setRegFamilyName('');
        setRegAdminName('');
        setRegPassword('');
        setShowRegister(false);
        setName(`${regAdminName}@${regFamilyName}`);
        alert('注册成功！请使用新生成的账号登录。');
      } else {
        alert(data.message || '注册失败');
      }
    } catch (e) {
      console.error(e);
      alert('网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-light rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-secondary-light rounded-full blur-3xl opacity-50" />
      
       <header className="text-center mb-12 relative z-10">
          <motion.div 
            initial={{ scale: 0, shadow: "0px 0px 0px rgba(79,70,229,0)" }} 
            animate={{ scale: 1, rotate: 360, shadow: "0px 20px 40px rgba(79,70,229,0.3)" }} 
            className="w-24 h-24 bg-brand rounded-[2.5rem] mx-auto flex items-center justify-center text-white mb-8"
          >
            <Star size={48} fill="currentColor" />
          </motion.div>
          <h1 className="text-5xl sm:text-7xl font-black text-gray-900 tracking-tighter mb-4">圆滚滚银行</h1>
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-gray-200" />
            <p className="text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">KiddieRewards ⋅ 智 慧 育 儿</p>
            <span className="h-px w-8 bg-gray-200" />
          </div>
       </header>

       <div className="w-full max-w-sm">
         <form onSubmit={handleLogin} className="space-y-4">
            <div className="bg-gray-50 p-1 rounded-[2rem] border border-gray-100 shadow-sm focus-within:ring-4 focus-within:ring-brand-light focus-within:border-brand-light transition-all">
              <div className="flex items-center gap-3 px-5 py-4">
                <User size={20} className="text-gray-400" />
                <input 
                  type="text"
                  required
                  placeholder="账号 (如: 爸爸@乐家)"
                  className="bg-transparent border-none outline-none w-full font-bold text-gray-900"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="h-px bg-gray-100 mx-5" />
              <div className="flex items-center gap-3 px-5 py-4">
                <Lock size={20} className="text-gray-400" />
                <input 
                  type="password"
                  required
                  placeholder="管理密码"
                  className="bg-transparent border-none outline-none w-full font-bold text-gray-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-red-500 font-bold text-xs text-center">
                {error}
              </motion.p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-brand text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-brand-light hover:bg-brand-hover transition-all active:scale-95 disabled:bg-gray-300"
            >
              {loading ? '正在进入...' : '立即登录'}
            </button>
         </form>

         <div className="mt-12 text-center space-y-6 relative z-10">
           <button 
             onClick={() => setShowRegister(true)}
             className="text-brand font-black text-xs uppercase tracking-widest hover:text-brand-hover transition-colors"
           >
             创建新家庭账户
           </button>

           <p className="text-gray-300 text-[10px] font-bold uppercase tracking-[2px]">让 每一个 小进步 都闪闪发光</p>
         </div>
       </div>

       {/* Register Modal */}
       <AnimatePresence>
         {showRegister && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRegister(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] p-10 max-w-sm w-full relative z-10 shadow-2xl">
                  <h2 className="text-3xl font-black text-gray-900 mb-2">创建新家庭</h2>
                   <form onSubmit={handleRegister} className="space-y-4 mt-8">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 px-2">家庭名称</label>
                      <input 
                        type="text"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand"
                        placeholder="例如：乐家"
                        value={regFamilyName}
                        onChange={(e) => setRegFamilyName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 px-2">家长称呼</label>
                      <input 
                        type="text"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand"
                        placeholder="例如：乐爸"
                        value={regAdminName}
                        onChange={(e) => setRegAdminName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 px-2">管理密码</label>
                      <input 
                        type="password"
                        className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-brand"
                        placeholder="设置 4-12 位密码"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={loading || !regAdminName || regPassword.length < 4}
                      className="w-full py-4 bg-brand text-white rounded-2xl font-black shadow-xl hover:bg-brand-hover transition-all mt-4"
                    >
                      {loading ? '创建中...' : '确认创建'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setShowRegister(false)}
                      className="w-full py-2 text-gray-400 font-bold text-sm"
                    >
                      取消并返回
                    </button>
                  </form>
               </motion.div>
            </div>
         )}
       </AnimatePresence>
    </div>
  );
};

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
      <div className={`min-h-screen theme-transition ${theme !== 'default' ? `theme-${theme}` : ''}`}>
        <Navbar 
          user={currentUser} 
          socket={socket} 
          onLogout={handleLogout}
          onSetTheme={setTheme}
          currentTheme={theme}
        />
        <SuperAdminView onLogout={handleLogout} />
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

