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
  Clock,
  Star,
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
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { requestNotificationPermission, sendBrowserNotification } from '../../lib/notificationHelper';
import { CustomSelect } from '../ui/CustomSelect';
import { useTabState } from '../../hooks/useTabState';
import { authFetch } from '../../lib/api';

export const ParentView = ({ user, onSwitchToChild, onLogout, onSetTheme, currentTheme }: { 
  user: UserProfile,
  onSwitchToChild: () => void,
  onLogout: () => void,
  onSetTheme: (theme: string) => void,
  currentTheme: string
}) => {
  const [activeTab, setActiveTab] = useTabState<string>('tab', 'dashboard');
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [records, setRecords] = useState<RedemptionRecord[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [pendingTasks, setPendingTasks] = useState<TaskSubmission[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<TaskSubmission[]>([]);
  const [showAddReward, setShowAddReward] = useState(false);
  const [newReward, setNewReward] = useState({ title: '', pointsRequired: 50, targetChildId: 'all' });
  const [editingReward, setEditingReward] = useState<RewardItem | null>(null);

  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ title: '', points: 10, description: '', isRepeating: true, targetChildId: 'all' });
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null);
  const [taskToReject, setTaskToReject] = useState<TaskSubmission | null>(null);
  const [redemptionToReject, setRedemptionToReject] = useState<RedemptionRecord | null>(null);
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

  const [growthHistory, setGrowthHistory] = useState<any[]>([]);
  const [growthTotal, setGrowthTotal] = useState(0);
  const [growthPage, setGrowthPage] = useState(1);
  const [growthFilterChildId, setGrowthFilterChildId] = useState('all');
  const growthLimit = 10;
  const child = children.find(c => c.id === selectedChildId) || null;

  const fetchGrowthHistory = async () => {
    try {
      const res = await authFetch(`/api/growth-history/${user.id}?childId=${growthFilterChildId}&page=${growthPage}&limit=${growthLimit}`);
      if (res.ok) {
        const data = await res.json();
        setGrowthHistory(data.items);
        setGrowthTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteHistoryItem = async (item: any) => {
    if (!confirm('确定要删除这条足迹吗？此操作不可逆。')) return;
    const url = item.type === 'task' ? `/api/tasks/${item.id}` : `/api/redemptions/${item.id}`;
    try {
      const res = await authFetch(url, { method: 'DELETE' });
      if (res.ok) {
        fetchGrowthHistory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'growth_manage') {
      fetchGrowthHistory();
    }
  }, [activeTab, growthPage, growthFilterChildId]);

  const addReward = async () => {
    const id = Math.random().toString(36).substr(2, 9);
    await authFetch('/api/rewards', {
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
    await authFetch(`/api/rewards/${editingReward.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingReward)
    });
    setEditingReward(null);
    fetchData();

  };

  const deleteReward = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个愿望吗？')) return;
    await authFetch(`/api/rewards/${id}`, { method: 'DELETE' });
    fetchData();

  };

  const fetchData = async () => {
    try {
      const resUsers = await authFetch('/api/users');
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

      const [resRules, resRecords, resRewards, resTasks, resAllSubmissions] = await Promise.all([
        authFetch(`/api/rules/${user.id}`),
        authFetch(`/api/redemptions/${user.id}`),
        authFetch(`/api/rewards/${user.id}`),
        authFetch(`/api/tasks/pending/${user.id}`),
        authFetch(`/api/tasks/all/${selectedChildId || 'all'}`)
      ]);

      if (!resRules.ok || !resRecords.ok || !resRewards.ok || !resTasks.ok || !resAllSubmissions.ok) {
        throw new Error("One or more dashboard APIs failed");
      }

      setRules(await resRules.json());
      setRecords(await resRecords.json());
      setRewards(await resRewards.json());
      setPendingTasks(await resTasks.json());
      setAllSubmissions(await resAllSubmissions.json());

      if (activeChild) {
        const resStats = await authFetch(`/api/stats/${activeChild.id}`);
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
    await authFetch('/api/users/add-member', {
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
    await authFetch('/api/users/update-password', {
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
      const res = await authFetch('/api/users/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id, 
          name: profileName
        })
      });
      if (!res.ok) throw new Error();

      // 密码修改走独立端点
      if (profilePassword?.trim()) {
        const pwRes = await authFetch('/api/users/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, newPassword: profilePassword })
        });
        if (!pwRes.ok) throw new Error('密码更新失败');
      }

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
      const res = await authFetch(`/api/users/${memberToDelete.id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || '删除失败');
      }
      
      if (selectedChildId === memberToDelete.id) setSelectedChildId(null);
      fetchData();

      setMemberToDelete(null);
    } catch (e) {
      console.error("Delete Member Error:", e);
      alert(e instanceof Error ? e.message : '删除失败，请稍后重试');
    }
  };

  const addRule = async () => {
    const id = Math.random().toString(36).substr(2, 9);
    await authFetch('/api/rules', {
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
    await authFetch(`/api/rules/${editingRule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingRule)
    });
    setEditingRule(null);
    fetchData();

  };

  const deleteRule = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这个规则吗？小朋友将无法再申请此任务。')) return;
    await authFetch(`/api/rules/${id}`, { method: 'DELETE' });
    fetchData();

  };

  const reactivateRule = async (ruleId: string, childId: string) => {
    try {
      const res = await authFetch('/api/rules/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, childId })
      });
      if (res.ok) {
        fetchData();

      }
    } catch (e) {
      console.error(e);
    }
  };

  const refreshPending = async () => {
    try {
      const [resTasks, resRecords] = await Promise.all([
        authFetch(`/api/tasks/pending/${user.id}`),
        authFetch(`/api/redemptions/${user.id}`)
      ]);
      if (resTasks.ok) setPendingTasks(await resTasks.json());
      if (resRecords.ok) setRecords(await resRecords.json());
    } catch (error) {
      console.error("refreshPending Error:", error);
    }
  };

  useEffect(() => {
    fetchData();
    requestNotificationPermission();

    let lastRefresh = 0;
    const handleGlobalClick = () => {
      const now = Date.now();
      if (now - lastRefresh > 5000) {
        lastRefresh = now;
        refreshPending();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [user, selectedChildId]);

  useEffect(() => {
    if (pendingTasks.length > 0) {
      const latestTask = pendingTasks[0];
      const lastNotifiedTaskId = localStorage.getItem(`last_notified_task_${user.id}`);
      if (lastNotifiedTaskId !== latestTask.id) {
        const childName = children.find(c => c.id === latestTask.childId)?.name || '孩子';
        sendBrowserNotification('新任务申请', {
          body: `${childName} 提交了任务: ${latestTask.title}`,
          tag: latestTask.id
        });
        localStorage.setItem(`last_notified_task_${user.id}`, latestTask.id);
      }
    }
  }, [pendingTasks, children, user.id]);

  useEffect(() => {
    const pendingRedemptions = records.filter(r => r.status === 'pending');
    if (pendingRedemptions.length > 0) {
      const latestRedemption = pendingRedemptions[0];
      const lastNotifiedRedId = localStorage.getItem(`last_notified_red_${user.id}`);
      if (lastNotifiedRedId !== latestRedemption.id) {
        const childName = children.find(c => c.id === latestRedemption.childId)?.name || '孩子';
        sendBrowserNotification('新愿望审批', {
          body: `${childName} 想要兑换: ${latestRedemption.rewardTitle}`,
          tag: latestRedemption.id
        });
        localStorage.setItem(`last_notified_red_${user.id}`, latestRedemption.id);
      }
    }
  }, [records, children, user.id]);

  useEffect(() => {
    // WebSocket 已移除
  }, [user.id]);

  const awardPointsDirectly = async (rule: RewardRule) => {
    if (!child) return;
    await authFetch('/api/points/add', {
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
    await authFetch('/api/tasks/approve', {
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
    
    await authFetch('/api/tasks/reject', {
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
    try {
      const res = await authFetch('/api/redemptions/approve', {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || data.error || '批准失败，请稍后重试');
        return;
      }
      fetchData();
    } catch (e) {
      console.error('approveRedemption error:', e);
      alert('网络错误，请稍后重试');
    }
  };

  const rejectRedemption = async () => {
    if (!redemptionToReject) return;
    try {
      const res = await authFetch('/api/redemptions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: redemptionToReject.id, 
          childId: redemptionToReject.childId, 
          rewardTitle: redemptionToReject.rewardTitle,
          rejectionReason: rejectionReasonInput || '抱歉，暂时不能兑换哦，再继续表现棒棒的吧！'
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || data.error || '拒绝失败，请稍后重试');
        return;
      }
      setRedemptionToReject(null);
      setRejectionReasonInput('');
      fetchData();
    } catch (e) {
      console.error('rejectRedemption error:', e);
      alert('网络错误，请稍后重试');
    }
  };

  return (
    <div className="pt-24 pb-32 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* 侧边栏 - 桌面端 */}
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
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-secondary-hover leading-none">{c.points}</span>
                    <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">星币</span>
                  </div>
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
                { id: 'growth_manage', label: '成长足迹管理', icon: Activity },
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


          <div className="pt-6 border-t border-gray-50">
            <h2 className="text-[10px] font-bold uppercase tracking-[2px] text-gray-400 mb-4 px-2">视图预览</h2>
            <button 
              onClick={onSwitchToChild}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-secondary hover:bg-secondary-light transition-all font-bold text-sm group"
            >
              <Smile size={18} className="group-hover:scale-110 transition-transform" />
              进入儿童端预览
            </button>
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

      {/* 主要内容 */}
      <div className="lg:col-span-9">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tighter truncate">你好, {user.name} 👋</h1>
                  <p className="text-sm sm:text-base text-gray-500 mt-2 font-medium">今天也请多多鼓励孩子们吧！</p>
                </div>
              </header>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 0. 星币排行榜 - 快速概览 */}
                <div className="bg-gradient-to-br from-brand to-brand-hover rounded-3xl p-8 shadow-xl shadow-brand-light flex flex-col md:col-span-2 text-white overflow-hidden relative">
                   <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8">
                         <h3 className="font-black text-2xl tracking-tighter flex items-center gap-2">
                           <Star size={24} className="text-yellow-300 animate-pulse" />
                           {children.length > 1 ? '星币财富榜' : '本月星币概况'}
                         </h3>
                         <div className="bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-xs font-bold">
                           {children.length > 1 ? `全家总计: ${children.reduce((acc, c) => acc + (c.points || 0), 0)} 星币` : '实时星币存款'}
                         </div>
                      </div>
                      
                      {children.length === 1 ? (
                        <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
                           <div className="relative">
                              <div className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center text-5xl">
                                 ✨
                              </div>
                              <motion.div 
                                animate={{ rotate: 360 }} 
                                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                                className="absolute inset-[-8px] border-2 border-dashed border-white/20 rounded-[2.5rem]"
                              />
                           </div>
                           <div className="text-center sm:text-left">
                              <h4 className="text-4xl font-black mb-2">{children[0].name}</h4>
                              <div className="flex items-center justify-center sm:justify-start gap-3">
                                 <div className="bg-white text-brand px-6 py-2 rounded-2xl text-2xl font-black shadow-xl">
                                   {children[0].points || 0} <span className="text-sm">星币</span>
                                 </div>
                                 <p className="text-sm font-medium opacity-80 max-w-[200px]">继续加油，解锁更多心愿吧！</p>
                              </div>
                           </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                           {children.sort((a, b) => (b.points || 0) - (a.points || 0)).map((c, idx) => (
                             <div key={c.id} className="bg-white/10 backdrop-blur-sm rounded-[2rem] p-5 border border-white/10 flex flex-col items-center text-center group hover:bg-white/20 transition-all">
                                <div className="relative mb-3">
                                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                                     {idx === 0 ? '👑' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '✨'))}
                                  </div>
                                  {idx === 0 && (
                                    <motion.div 
                                      animate={{ rotate: 360 }} 
                                      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                      className="absolute inset-[-4px] border-2 border-dashed border-yellow-300 rounded-[1.25rem] opacity-50"
                                    />
                                  )}
                                </div>
                                <p className="font-black text-lg mb-1 truncate w-full px-2">{c.name}</p>
                                <div className="bg-white text-brand px-3 py-1 rounded-xl text-sm font-black shadow-lg">
                                  {c.points || 0}
                                </div>
                             </div>
                           ))}
                           {children.length === 0 && (
                             <p className="col-span-full py-8 text-white/50 font-bold italic text-center">暂无家庭成员</p>
                           )}
                        </div>
                      )}
                   </div>
                    {/* 装饰性背景圆 */}
                   <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                   <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                </div>

                {/* 1. 直接加分 */}
                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
                        <Zap size={20} className="text-brand" />
                        直接加分
                      </h3>
                      <button onClick={() => setActiveTab('rules')} className="text-xs text-brand font-bold hover:underline">管理规则</button>
                   </div>
                   <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {rules.filter(r => r.isRepeating).slice(0, 4).length === 0 ? (
                        <div className="py-10 text-center opacity-40">
                           <Zap size={40} className="mx-auto mb-2 text-gray-300" />
                           <p className="text-xs font-bold text-gray-400">暂无日常规则</p>
                        </div>
                      ) : (
                        rules.filter(r => r.isRepeating).slice(0, 4).map(rule => (
                          <button 
                            key={rule.id}
                            onClick={() => awardPointsDirectly(rule)}
                            className="w-full flex items-start justify-between gap-4 p-4 rounded-2xl border border-gray-50 hover:border-brand-light hover:bg-brand-light/30 transition-all group text-left"
                          >
                            <div className="flex items-start gap-3 flex-1">
                               <div className="w-10 h-10 shrink-0 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-brand transition-colors">
                                 <Plus size={18} />
                               </div>
                               <div className="min-w-0">
                                  <p className="font-bold text-gray-800 leading-tight mb-1 break-words">{rule.title}</p>
                                  <span className="text-[10px] font-black text-brand bg-brand-light px-2 py-0.5 rounded">+{rule.points} 星币</span>
                               </div>
                            </div>
                            <div className="bg-brand hover:bg-brand-hover text-white p-2.5 rounded-xl shadow-md shadow-brand-light transition-colors self-center">
                               <Check size={18} />
                            </div>
                          </button>
                        ))
                      )}
                   </div>
                </div>

                {/* 2. 待确认任务 */}
                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
                        <Clock size={20} className="text-brand" />
                        待确认任务
                      </h3>
                      <button onClick={() => setActiveTab('tasks')} className="text-xs text-brand font-bold hover:underline">查看全部 ({pendingTasks.length})</button>
                   </div>
                   <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {pendingTasks.slice(0, 4).map(task => (
                        <div key={task.id} className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-brand-light/20 border border-brand-light/50 text-left">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-brand-hover leading-tight mb-1 break-words">{task.title}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-brand bg-white px-2 py-0.5 rounded">+{task.points} 星币</span>
                              {children.length > 1 && <span className="text-[10px] font-bold text-brand-hover/60">申请人: {children.find(c => c.id === task.childId)?.name}</span>}
                            </div>
                          </div>
                          <button 
                            onClick={() => approveTask(task)}
                            className="bg-brand hover:bg-brand-hover text-white p-2.5 rounded-xl shadow-md shadow-brand-light transition-colors self-center"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      ))}
                      {pendingTasks.length === 0 && (
                        <div className="py-10 flex flex-col items-center justify-center opacity-40">
                           <Star size={40} className="text-gray-300 mb-2" />
                           <p className="text-xs font-bold text-gray-400">目前没有待确认的任务</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* 3. 待处理兑换 - 作为第三张卡片占满整行 */}
                <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col md:col-span-2">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="font-black text-xl text-gray-900 flex items-center gap-2">
                        <Gift size={20} className="text-secondary" />
                        待处理兑换
                      </h3>
                      <button onClick={() => setActiveTab('redemptions')} className="text-xs text-brand font-bold hover:underline">去审批 ({records.filter(r => r.status === 'pending').length})</button>
                   </div>
                   <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      {records.filter(r => r.status === 'pending').slice(0, 3).map(record => (
                        <div key={record.id} className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-secondary-light/20 border border-secondary/20 text-left">
                          <div className="w-12 h-12 rounded-xl bg-white flex-shrink-0 overflow-hidden border border-secondary/10">
                             <img 
                               src={`https://picsum.photos/seed/${record.rewardId}/100/100`} 
                               alt={record.rewardTitle}
                               className="w-full h-full object-cover"
                               referrerPolicy="no-referrer"
                             />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-secondary-hover leading-tight mb-1 break-words">{record.rewardTitle}</p>
                            <div className="flex items-center gap-2">
                              {children.length > 1 && <span className="text-[10px] font-bold text-secondary-hover/60">申请人: {children.find(c => c.id === record.childId)?.name}</span>}
                              <span className="text-[10px] text-gray-400">• {new Date(record.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => approveRedemption(record)}
                            className="bg-secondary hover:bg-secondary-hover text-white p-2.5 rounded-xl shadow-md shadow-secondary-light transition-colors self-center"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      ))}
                      {records.filter(r => r.status === 'pending').length === 0 && (
                        <div className="py-10 flex flex-col items-center justify-center opacity-40">
                           <Gift size={40} className="text-gray-300 mb-2" />
                           <p className="text-xs font-bold text-gray-400">所有心愿都处理完啦</p>
                        </div>
                      )}
                   </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'family_manage' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">家庭及成员</h1>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium">管理您的家庭信息与成员设置</p>
                  </div>
               </div>

                {/* 部分：应用设置 / 主题 */}
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

                {/* 部分：你的账号 */}
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

                {/* 孩子列表 */}
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
                              {m.role === 'child' && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-yellow-50 text-yellow-600 uppercase tracking-wider">
                                  ✨ {m.points || 0} 星币
                                </span>
                              )}
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
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">加分确认与管理</h1>
                  <button 
                    onClick={() => fetchData()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 text-brand font-bold bg-brand-light/50 hover:bg-brand-light px-6 py-3 rounded-2xl transition-all active:scale-95 shrink-0"
                  >
                    <RotateCw size={18} />
                    <span className="whitespace-nowrap">刷新列表</span>
                  </button>
               </div>
               {pendingTasks.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4">
                    {pendingTasks.map(task => (
                      <div key={task.id} className="bg-white p-5 sm:p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand-light text-brand rounded-2xl flex items-center justify-center shrink-0">
                               <Zap size={24} className="sm:hidden" /><Zap size={28} className="hidden sm:block" />
                            </div>
                            <div>
                               <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{task.title}</p>
                               <div className="flex items-center gap-3 mt-1">
                                 <span className="text-xs font-black text-brand bg-brand-light px-2 py-0.5 rounded">+{task.points} 星币</span>
                                  {children.length > 1 && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{children.find(c => c.id === task.childId)?.name}</span>}
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">
                                    {new Date(task.timestamp).toLocaleDateString()}
                                  </span>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
                            <button 
                              onClick={() => rejectTask(task)}
                              className="flex-1 sm:w-28 h-12 rounded-2xl font-black text-sm text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 group"
                            >
                              <X size={18} className="transition-transform group-hover:rotate-90" /><span>拒绝</span>
                            </button>
                            <button 
                              onClick={() => approveTask(task)}
                              className="flex-1 sm:w-28 h-12 rounded-2xl bg-brand text-white font-black text-sm sm:text-base shadow-lg shadow-brand-light hover:bg-brand-hover transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 group"
                            >
                              <Check size={18} className="transition-transform group-hover:scale-125" /><span>通过</span>
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
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">奖励规则管理</h1>
                  <button 
                    onClick={() => setShowAddRule(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-brand-light hover:bg-brand-hover transition-all active:scale-95 shrink-0"
                  >
                    <Plus size={20} />
                    <span className="whitespace-nowrap">添加新规则</span>
                  </button>
               </div>
               <div className="grid grid-cols-1 gap-4 text-gray-900">
                  {rules.map(rule => {
                    const isCompletedForSelected = !rule.isRepeating && allSubmissions.some(s => s.status === 'approved' && s.ruleId === rule.id && s.childId === (rule.targetChildId === 'all' || !rule.targetChildId ? selectedChildId : rule.targetChildId));

                    return (
                      <div key={rule.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isCompletedForSelected ? 'bg-green-50 text-green-500' : 'bg-brand-light text-brand'}`}>
                                {isCompletedForSelected ? <Check size={24} /> : <Zap size={24} />}
                             </div>
                             <div>
                                <p className={`font-bold ${isCompletedForSelected ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{rule.title}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isCompletedForSelected ? 'bg-gray-50 text-gray-400' : 'bg-brand-light text-brand'}`}>+{rule.points} 星币</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.isRepeating ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                    {rule.isRepeating ? '日常规则' : '特别加分'}
                                  </span>
                                  {rule.targetChildId && rule.targetChildId !== 'all' && (
                                     <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                                       仅限 {children.find(c => c.id === rule.targetChildId)?.name || '未知孩子'}
                                     </span>
                                  )}
                                  {isCompletedForSelected && (
                                     <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-100 text-green-600 animate-pulse">
                                       已达成 ✨
                                     </span>
                                  )}
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             {isCompletedForSelected && (
                               <button 
                                 onClick={() => reactivateRule(rule.id, (rule.targetChildId === 'all' || !rule.targetChildId) ? (selectedChildId || '') : (rule.targetChildId || ''))}
                                 className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-xl transition-colors"
                                 title="重新激活"
                               >
                                 <RotateCw size={18} />
                               </button>
                             )}
                             <button onClick={() => setEditingRule(rule)} className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light rounded-xl transition-colors">
                                <Edit2 size={18} />
                             </button>
                             <button onClick={(e) => deleteRule(rule.id, e)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                <Trash2 size={18} />
                             </button>
        </div>
      </div>
    );
                  })}
               </div>
            </motion.div>
          )}

          {activeTab === 'redemptions' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">愿望兑换审批</h1>
                  <button 
                    onClick={() => fetchData()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 text-brand font-bold bg-brand-light/50 hover:bg-brand-light px-6 py-3 rounded-2xl transition-all active:scale-95 shrink-0"
                  >
                    <RotateCw size={18} />
                    <span className="whitespace-nowrap">刷新列表</span>
                  </button>
               </div>

                {/* 第一部分：待处理兑换 */}
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
                         const canApprove = applicant && applicant.points >= (reward?.pointsRequired || 0);
                         return (
                           <div key={record.id} className="bg-white p-5 sm:p-6 rounded-[2.5rem] border-2 border-secondary-light shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                                 <div className="w-12 h-12 sm:w-14 sm:h-14 bg-secondary-light text-secondary rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                                    <img 
                                      src={`https://picsum.photos/seed/${record.rewardId}/200/200`} 
                                      alt={record.rewardTitle}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                 </div>
                                 <div>
                                    <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{record.rewardTitle}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                       <span className="text-xs font-black text-secondary bg-secondary-light px-2 py-0.5 rounded">
                                         需 {reward?.pointsRequired || '?'} 星币
                                       </span>
                                       {children.length > 1 && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{applicant?.name} 的申请</span>}
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 sm:shrink-0 self-end sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
                                 <button 
                                   onClick={() => setRedemptionToReject(record)}
                                   className="px-6 h-12 rounded-2xl font-black text-sm text-red-500 bg-red-50 hover:bg-red-500 hover:text-white transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 group"
                                 >
                                   <X size={18} className="transition-transform group-hover:rotate-90" /><span>不同意</span>
                                 </button>
                                 <button 
                                   onClick={() => approveRedemption(record)}
                                   disabled={!canApprove}
                                   className={`flex-1 sm:px-8 h-12 rounded-2xl font-black text-sm sm:text-lg transition-all active:scale-95 whitespace-nowrap flex items-center justify-center gap-2 group ${
                                     canApprove
                                     ? 'bg-secondary text-white shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4)] hover:shadow-[0_12px_25px_-4px_rgba(245,158,11,0.5)] hover:bg-secondary-hover hover:-translate-y-0.5'
                                     : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                                   }`}
                                 >
                                   {canApprove && <Check size={18} className="transition-transform group-hover:scale-125" />}
                                   <span>{canApprove ? '准许兑换' : '积分不足'}</span>
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

          {activeTab === 'growth_manage' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">成长足迹管理</h1>
                    <p className="text-sm text-gray-500 font-medium">查看并管理孩子们的成长记录</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {children.length > 1 && (
                      <CustomSelect 
                        value={growthFilterChildId}
                        onChange={(val) => { setGrowthFilterChildId(val); setGrowthPage(1); }}
                        options={[{ id: 'all', label: '所有孩子' }, ...children.map(c => ({ id: c.id, label: c.name }))]}
                        className="min-w-[140px]"
                      />
                    )}
                    <button 
                      onClick={() => fetchGrowthHistory()}
                      className="p-4 bg-gray-50 text-gray-400 hover:text-brand rounded-[1.25rem] transition-all shadow-sm border border-transparent hover:border-brand/20"
                    >
                      <RotateCw size={18} />
                    </button>
                  </div>
               </div>

               <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-50">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">时间</th>
                          {children.length > 1 && <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">孩子</th>}
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">记录类型</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">状态</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">内容</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">星币变动</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {growthHistory.length > 0 ? (
                          growthHistory.map((item) => (
                            <tr key={item.id} className={`hover:bg-gray-50/30 transition-colors ${item.status === 'rejected' ? 'opacity-60' : ''}`}>
                              <td className="px-6 py-4">
                                <p className="text-xs font-bold text-gray-500 whitespace-nowrap">
                                  {new Date(item.timestamp).toLocaleDateString()}
                                  <br />
                                  <span className="font-medium opacity-60">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </p>
                              </td>
                              {children.length > 1 && (
                                <td className="px-6 py-4">
                                  <span className="text-sm font-black text-gray-900 whitespace-nowrap">
                                    {children.find(c => c.id === item.childId)?.name || '未知孩子'}
                                  </span>
                                </td>
                              )}
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${
                                  item.type === 'task' ? 'bg-brand-light text-brand' : 'bg-secondary-light text-secondary'
                                }`}>
                                  {item.type === 'task' ? '获得奖励' : '兑换星愿'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap ${
                                  item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.status === 'approved' ? '已通过' : '被拒绝'}
                                </span>
                              </td>
                              <td className="px-6 py-4 min-w-[200px]">
                                <p className="text-sm font-bold text-gray-800 line-clamp-1">{item.title}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-sm font-black whitespace-nowrap ${
                                  item.status === 'rejected' ? 'text-gray-400' : (item.points > 0 ? 'text-brand' : 'text-secondary')
                                }`}>
                                  {item.status === 'rejected' ? '0' : (item.points > 0 ? `+${item.points}` : item.points)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => deleteHistoryItem(item)}
                                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-bold italic text-sm">
                              暂无足迹记录
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {growthTotal > growthLimit && (
                    <div className="p-6 border-t border-gray-50 flex items-center justify-between">
                       <p className="text-xs font-bold text-gray-400">共 {growthTotal} 条记录</p>
                       <div className="flex items-center gap-2">
                          <button 
                            disabled={growthPage === 1}
                            onClick={() => setGrowthPage(p => Math.max(1, p - 1))}
                            className="w-10 h-10 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 disabled:opacity-30 hover:bg-gray-50 transition-all font-black text-sm"
                          >
                             <Calendar size={18} className="rotate-90" /> {/* 用作左箭头代理 */}
                          </button>
                          <span className="text-sm font-black px-4">{growthPage}</span>
                          <button 
                            disabled={growthPage * growthLimit >= growthTotal}
                            onClick={() => setGrowthPage(p => p + 1)}
                            className="w-10 h-10 rounded-xl border border-gray-100 flex items-center justify-center text-gray-400 disabled:opacity-30 hover:bg-gray-50 transition-all font-black text-sm"
                          >
                             <ChevronRight size={18} />
                          </button>
                       </div>
                    </div>
                  )}
               </div>
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
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">奖励项目管理</h1>
                  <button 
                    onClick={() => setShowAddReward(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-brand-light hover:bg-brand-hover transition-all active:scale-95 shrink-0"
                  >
                    <Plus size={20} />
                    <span className="whitespace-nowrap">添加奖励</span>
                  </button>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {rewards.map(item => (
                    <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-brand-light text-brand rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                             <img 
                               src={`https://picsum.photos/seed/${item.id}/200/200`} 
                               alt={item.title}
                               className="w-full h-full object-cover"
                               referrerPolicy="no-referrer"
                             />
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
        {showChangePassword && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowChangePassword(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-brand-light text-brand rounded-2xl flex items-center justify-center">
                  <Lock size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-none">重置成员密码</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">
                    正在为 {familyMembers.find(m => m.id === selectedChildId)?.name} 修改
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-2 px-2">新密码</label>
                  <input 
                    type="password" 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-900 focus:ring-2 focus:ring-brand" 
                    placeholder="请输入新密码" 
                    value={changedPassword} 
                    onChange={(e) => setChangedPassword(e.target.value)} 
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowChangePassword(false)} className="flex-1 py-4 font-bold text-gray-400">取消</button>
                  <button onClick={updateChildPassword} className="flex-2 py-4 bg-brand text-white rounded-2xl font-black shadow-lg shadow-brand-light hover:bg-brand-hover active:scale-95 transition-all">确认重置</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddReward && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddReward(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-6 text-gray-900">发布新的愿望</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">愿望名称</label>
                  <input type="text" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" placeholder="如：买一套乐高" value={newReward.title} onChange={(e) => setNewReward({...newReward, title: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">所需积分</label>
                  <input type="number" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" value={newReward.pointsRequired} onChange={(e) => setNewReward({...newReward, pointsRequired: parseInt(e.target.value)})} />
                </div>
                {children.length > 1 && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">适用对象</label>
                    <CustomSelect 
                      value={newReward.targetChildId}
                      onChange={(val) => setNewReward({...newReward, targetChildId: val})}
                      options={[{ id: 'all', label: '所有人' }, ...children.map(c => ({ id: c.id, label: c.name }))]}
                    />
                  </div>
                )}
                <button onClick={addReward} className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4">确认发布</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingReward && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingReward(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-6 text-gray-900">编辑愿望</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">愿望名称</label>
                  <input type="text" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" value={editingReward.title} onChange={(e) => setEditingReward({...editingReward, title: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">所需积分</label>
                  <input type="number" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" value={editingReward.pointsRequired} onChange={(e) => setEditingReward({...editingReward, pointsRequired: parseInt(e.target.value)})} />
                </div>
                {children.length > 1 && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">适用对象</label>
                    <CustomSelect 
                      value={editingReward.targetChildId || 'all'}
                      onChange={(val) => setEditingReward({...editingReward, targetChildId: val})}
                      options={[{ id: 'all', label: '所有人' }, ...children.map(c => ({ id: c.id, label: c.name }))]}
                    />
                  </div>
                )}
                <button onClick={updateReward} className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4">保存修改</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingRule && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingRule(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black mb-6 text-gray-900">编辑任务规则</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">任务名称</label>
                  <input type="text" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" value={editingRule.title} onChange={(e) => setEditingRule({...editingRule, title: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">奖励数值 (星币)</label>
                  <input type="number" className="w-full bg-gray-50 border-none rounded-xl p-4 font-semibold text-gray-900 focus:ring-2 focus:ring-brand" value={editingRule.points} onChange={(e) => setEditingRule({...editingRule, points: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">规则类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setEditingRule({...editingRule, isRepeating: true})}
                      className={`py-3 rounded-xl font-bold text-xs transition-all ${editingRule.isRepeating ? 'bg-brand text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}
                    >
                      日常加分
                    </button>
                    <button 
                      onClick={() => setEditingRule({...editingRule, isRepeating: false})}
                      className={`py-3 rounded-xl font-bold text-xs transition-all ${!editingRule.isRepeating ? 'bg-brand text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}
                    >
                      一次性成就
                    </button>
                  </div>
                </div>
                {children.length > 1 && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">适用对象</label>
                    <CustomSelect 
                      value={editingRule.targetChildId || 'all'}
                      onChange={(val) => setEditingRule({...editingRule, targetChildId: val})}
                      options={[{ id: 'all', label: '所有人' }, ...children.map(c => ({ id: c.id, label: c.name }))]}
                    />
                  </div>
                )}
                <button onClick={updateRule} className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4">保存规则</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">规则类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setNewRule({...newRule, isRepeating: true})}
                      className={`py-3 rounded-xl font-bold text-xs transition-all ${newRule.isRepeating ? 'bg-brand text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}
                    >
                      日常加分 (每日可领)
                    </button>
                    <button 
                      onClick={() => setNewRule({...newRule, isRepeating: false})}
                      className={`py-3 rounded-xl font-bold text-xs transition-all ${!newRule.isRepeating ? 'bg-brand text-white shadow-md' : 'bg-gray-50 text-gray-400'}`}
                    >
                      一次性成就
                    </button>
                  </div>
                </div>
                {children.length > 1 && (
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">适用对象</label>
                    <CustomSelect 
                      value={newRule.targetChildId}
                      onChange={(val) => setNewRule({...newRule, targetChildId: val})}
                      options={[{ id: 'all', label: '所有人' }, ...children.map(c => ({ id: c.id, label: c.name }))]}
                    />
                  </div>
                )}
                <button onClick={addRule} className="w-full py-4 bg-brand text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-light hover:bg-brand-hover mt-4">确认添加</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* ... 如果需要AddReward, EditReward, EditRule等的弹窗 ... */}
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

      {/* 任务拒绝弹窗 */}
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

      <AnimatePresence>
        {redemptionToReject && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setRedemptionToReject(null); setRejectionReasonInput(''); }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full relative z-10 shadow-2xl">
              <h2 className="text-2xl font-black text-gray-900 mb-2">不同意兑换？</h2>
              <p className="text-sm font-bold text-gray-400 mb-6 uppercase tracking-widest leading-relaxed text-center sm:text-left">让孩子知道这次不能兑换的原因吧</p>
              <textarea 
                className="w-full bg-gray-50 border-none rounded-2xl p-5 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-red-400 transition-all mb-6 min-h-[120px] resize-none"
                placeholder="例如：最近的学习表现还需要继续观察哦，再坚持一周就能兑换啦！"
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
              />
              <div className="flex gap-4">
                <button onClick={() => { setRedemptionToReject(null); setRejectionReasonInput(''); }} className="flex-1 py-4 font-bold text-gray-400">取消</button>
                <button onClick={rejectRedemption} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-200 active:scale-95 transition-all">确认拒绝</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 移动端标签栏 */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 bg-white/95 backdrop-blur-lg border border-gray-100 p-2 z-50 rounded-[2.5rem] shadow-2xl overflow-x-auto no-scrollbar flex justify-start">
         <div className="flex items-center gap-2 px-4 py-1 shrink-0 w-max">
           {[
            { id: 'dashboard', icon: LayoutDashboard },
            { id: 'task_approval', icon: CheckCircle },
            { id: 'rules', icon: Zap },
            { id: 'rewards_manage', icon: Gift },
            { id: 'redemptions', icon: Check },
            { id: 'growth_manage', icon: Activity },
             { id: 'analysis', icon: PieChart },
             { id: 'family_manage', icon: Settings }
           ].map(item => (
             <button 
               key={item.id} 
               onClick={() => setActiveTab(item.id)} 
               className={`p-4 rounded-2xl transition-all flex items-center justify-center ${activeTab === item.id ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-gray-400 active:bg-gray-50'}`}
             >
               <item.icon size={22} />
            </button>
          ))}
          <div className="w-6 shrink-0" />
         </div>
      </div>
    </div>
  );
};
