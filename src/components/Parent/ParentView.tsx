import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  LayoutDashboard,
  Users,
  ShieldAlert,
  FileSearch,
  CheckCircle,
  X,
  Calendar,
  ChevronRight,
  Activity,
  Edit2,
  Check,
  RotateCw,
  LogOut,
  Layout,
  PieChart,
  Zap,
  Gift,
  Smile,
  Settings,
  Sparkles,
  User,
  Lock,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  UserProfile, 
  RewardRule, 
  RewardItem, 
  RedemptionRecord, 
  TaskSubmission 
} from '../../types';

export const ParentView = ({ user, socket, onSwitchToChild, onLogout, onSetTheme, currentTheme }: { 
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
                            <p className="text-[10px] font-bold text-brand-hover/70">{children.find(c => c.id === task.childId)?.name} 申请加分</p>
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
                            <p className="text-[10px] font-bold text-secondary-hover/70">{children.find(c => c.id === record.childId)?.name} 发起</p>
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

               {/* Children List */}
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
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{children.find(c => c.id === task.childId)?.name}</span>
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
                         const applicant = children.find(c => c.id === record.childId);
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
                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{applicant?.name} 的申请</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <button 
                                   onClick={() => approveRedemption(record)}
                                   disabled={applicant && applicant.points < (reward?.pointsRequired || 0)}
                                   className={`px-8 h-12 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 ${
                                     applicant && applicant.points >= (reward?.pointsRequired || 0)
                                     ? 'bg-secondary text-white shadow-secondary-light hover:bg-secondary-hover'
                                     : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                   }`}
                                 >
                                   {applicant && applicant.points >= (reward?.pointsRequired || 0) ? '准许兑换' : '积分不足'}
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
                      stroke="#4f46e5" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAddRule && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddRule(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-6">新建任务规则</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">任务名称</label>
                  <input type="text" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold focus:ring-2 focus:ring-brand text-gray-900" placeholder="如：自己刷牙" value={newRule.title} onChange={(e) => setNewRule({...newRule, title: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">奖励数值 (星币)</label>
                  <input type="number" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold focus:ring-2 focus:ring-brand text-gray-900" value={newRule.points} onChange={(e) => setNewRule({...newRule, points: parseInt(e.target.value)})} />
                </div>
                <button onClick={addRule} className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4">确认添加</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* ... Add modals for AddReward, EditReward, EditRule, etc if skipped ... */}
       <AnimatePresence>
        {showAddChild && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddChild(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-6 text-gray-900">添加家庭成员</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">成员名称</label>
                  <input type="text" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" placeholder="例如：乐妈" value={newChildName} onChange={(e) => setNewChildName(e.target.value)} />
                </div>
                <button onClick={addMember} className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4">确认添加成员</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Rejection Modal */}
      <AnimatePresence>
        {taskToReject && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setTaskToReject(null); setRejectionReasonInput(''); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-2 text-gray-900">不通过申请</h2>
              <textarea className="w-full bg-gray-50 border-none rounded-2xl p-4 font-semibold focus:ring-2 focus:ring-red-500 text-gray-900 h-32 resize-none mt-4" placeholder="请填写原因..." value={rejectionReasonInput} onChange={(e) => setRejectionReasonInput(e.target.value)} />
              <div className="grid grid-cols-2 gap-4 mt-6">
                <button onClick={() => setTaskToReject(null)} className="py-4 font-bold text-gray-400">取消</button>
                <button onClick={() => rejectTask(taskToReject)} className="py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg">确认不通过</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {memberToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMemberToDelete(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full relative z-10 shadow-2xl text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2 text-gray-900">确定要删除吗？</h2>
              <p className="text-gray-500 mb-8 font-medium">正在删除 {memberToDelete.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setMemberToDelete(null)} className="py-4 font-bold text-gray-400">取消</button>
                <button onClick={executeDeleteMember} className="py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg">确认删除</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Tab Bar */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 bg-white/80 backdrop-blur-md border border-gray-100 px-6 py-4 flex items-center justify-between z-50 rounded-[2.5rem] shadow-2xl overflow-x-auto no-scrollbar gap-4">
         {[
          { id: 'dashboard', icon: Layout },
          { id: 'task_approval', icon: CheckCircle },
          { id: 'rules', icon: Zap },
          { id: 'rewards_manage', icon: Gift },
          { id: 'redemptions', icon: Check },
          { id: 'analysis', icon: PieChart },
          { id: 'family_manage', icon: Settings }
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`p-3 rounded-2xl transition-all shrink-0 ${activeTab === item.id ? 'bg-brand text-white shadow-lg' : 'text-gray-400'}`}>
            <item.icon size={24} />
          </button>
        ))}
      </div>
    </div>
  );
};
