import React, { useState, useEffect, useMemo } from 'react';
import { 
  Star, 
  History, 
  Check, 
  ChevronRight, 
  Trophy, 
  Bell,
  Gift,
  Zap,
  CheckCircle,
  X,
  AlertCircle,
  PartyPopper,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { 
  UserProfile, 
  RewardRule, 
  RewardItem, 
  RedemptionRecord, 
  PointHistory, 
  TaskSubmission, 
  AppNotification 
} from '../../types';
import { requestNotificationPermission, sendBrowserNotification } from '../../lib/notificationHelper';

export const ChildView = ({ user, socket }: { user: UserProfile, socket: Socket | null }) => {
  const [activeTab, setActiveTab ] = useState('rewards');
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [history, setHistory] = useState<PointHistory[]>([]);
  const [rejectedTasks, setRejectedTasks] = useState<TaskSubmission[]>([]);
  const [localPoints, setLocalPoints] = useState(user.points);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [successToastType, setSuccessToastType] = useState<'task' | 'redemption'>('task');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifCenter, setShowNotifCenter] = useState(false);
  const [showCelebration, setShowCelebration ] = useState(false);
  const [celebratedReward, setCelebratedReward] = useState<RewardItem | null>(null);
  const [showAchievementCelebration, setShowAchievementCelebration] = useState(false);
  const [celebratedAchievement, setCelebratedAchievement] = useState<{title: string, ruleId: string} | null>(null);
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

      return { rewards: rewardsData, notifications: notifsData };
    } catch (error) {
      console.error("Child fetchData Error:", error);
      return null;
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
          parentId: user.parentId || 'p1', 
          ruleId: rule.id,
          points: rule.points, 
          title: `${rule.title} (申请确认)` 
        })
      });
      setSuccessToastType('task');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      fetchData();
    } finally {
      setSubmittingId(null);
    }
  };

  useEffect(() => {
    fetchData();
    requestNotificationPermission();
  }, [user]);

  useEffect(() => {
    if (notifications.length > 0) {
      const hasUnread = notifications.some(n => !n.isRead);
      if (hasUnread) {
        const latestNotif = notifications[0]; // Assuming newest is first
        const lastNotifiedId = localStorage.getItem(`last_notified_child_${user.id}`);
        
        if (lastNotifiedId !== latestNotif.id && !latestNotif.isRead) {
          sendBrowserNotification(latestNotif.title, {
            body: latestNotif.message,
            tag: latestNotif.id
          });
          localStorage.setItem(`last_notified_child_${user.id}`, latestNotif.id);
        }
      }
    }
  }, [notifications, user.id]);

  useEffect(() => {
    // Real-time auto-fetch disabled per user request
    if (!socket) return;
    // socket.on('new_notification', fetchData); // Disabled
  }, [socket, user.id]);

  const openNotifCenter = async () => {
    const data = await fetchData();
    setShowNotifCenter(true);
    if (data) {
      markNotifsRead(data.notifications, data.rewards);
    } else {
      markNotifsRead();
    }
  };

  const markNotifsRead = async (manualNotifs?: AppNotification[], manualRewards?: RewardItem[]) => {
    const targetNotifs = manualNotifs || notifications;
    const targetRewards = manualRewards || rewards;

    // Check for unread wish achievements first
    const unreadWishNotif = targetNotifs.find(n => !n.isRead && n.type === 'wish_granted');
    const unreadAchievementNotif = targetNotifs.find(n => !n.isRead && n.type === 'achievement_granted');

    if (unreadWishNotif) {
      try {
        const metadata = JSON.parse(unreadWishNotif.metadata || '{}');
        const targetReward = targetRewards.find(r => r.id === metadata.rewardId);
        if (targetReward) {
          setCelebratedReward(targetReward);
          setShowCelebration(true);
          playCelebrationSound('wish');
        }
      } catch (e) {
        console.error("Error parsing notification metadata:", e);
      }
    } else if (unreadAchievementNotif) {
      try {
        const metadata = JSON.parse(unreadAchievementNotif.metadata || '{}');
        if (metadata.title) {
          setCelebratedAchievement({ title: metadata.title, ruleId: metadata.ruleId });
          setShowAchievementCelebration(true);
          playCelebrationSound('achievement');
        }
      } catch (e) {
        console.error("Error parsing achievement notification metadata:", e);
      }
    }

    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
  };

  const playCelebrationSound = (type: 'wish' | 'achievement') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type === 'wish' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };
      if (type === 'wish') {
        playTone(523.25, 0, 0.1); 
        playTone(659.25, 0.1, 0.1); 
        playTone(783.99, 0.2, 0.3);
        playTone(1046.50, 0.4, 0.5);
      } else {
        // More robust fanfare for achievement
        playTone(392.00, 0, 0.1); // G4
        playTone(392.00, 0.1, 0.1); // G4
        playTone(523.25, 0.25, 0.4); // C5
      }
    } catch (e) {}
  };

  const redeem = async (reward: RewardItem) => {
    if (localPoints < reward.pointsRequired) {
      alert('星币不足哦，再努力积累一点吧！加油！');
      return;
    }
    
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
      
      setSuccessToastType('redemption');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      fetchData();
    } catch (error) {
      alert('无法提交申请，请稍后再试。');
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
          onClick={openNotifCenter}
          className="w-16 h-16 bg-white border-2 border-gray-100 rounded-[1.8rem] shadow-sm flex items-center justify-center relative hover:shadow-xl hover:border-brand-light transition-all active:scale-95"
        >
          <Bell size={28} className={notifications.some(n => !n.isRead) ? "text-brand animate-bounce" : "text-gray-400"} />
          {notifications.some(n => !n.isRead) && (
            <span className="absolute top-4 right-4 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg">
              {notifications.filter(n => !n.isRead).length}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] ${successToastType === 'redemption' ? 'bg-secondary' : 'bg-brand'} text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold`}
          >
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              {successToastType === 'redemption' ? <Gift size={16} /> : <Check size={16} />}
            </div>
            <span>{successToastType === 'redemption' ? '愿望申请已送达，等爸爸妈妈点头哦！' : '任务已提交，等爸爸妈妈确认哦！'}</span>
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

        <div className="flex flex-wrap justify-center gap-4">
           <button onClick={() => setActiveTab('rewards')} className={`flex-1 min-w-[140px] flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all ${activeTab === 'rewards' ? 'bg-white border-brand shadow-xl shadow-brand-light' : 'bg-gray-50 border-transparent text-gray-400'}`}>
              <Gift size={32} className={activeTab === 'rewards' ? 'text-brand' : ''} />
              <span className="font-black mt-2 text-sm text-center">愿望单</span>
           </button>
           <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[140px] flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all ${activeTab === 'history' ? 'bg-white border-brand shadow-xl shadow-brand-light' : 'bg-gray-50 border-transparent text-gray-400'}`}>
              <History size={32} className={activeTab === 'history' ? 'text-brand' : ''} />
              <span className="font-black mt-2 text-sm text-center">成长足迹</span>
           </button>
           <button onClick={() => setActiveTab('tasks')} className={`flex-1 min-w-[140px] flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all ${activeTab === 'tasks' ? 'bg-white border-brand shadow-xl shadow-brand-light' : 'bg-gray-50 border-transparent text-gray-400'}`}>
              <Zap size={32} className={activeTab === 'tasks' ? 'text-brand' : ''} />
              <span className="font-black mt-2 text-sm text-center">做任务</span>
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
                
                // Success criteria based on rule type
                const isApprovedToday = ruleSubmissions.some(s => s.status === 'approved' && new Date(s.timestamp).toDateString() === new Date().toDateString());
                const isCompletedEver = ruleSubmissions.some(s => s.status === 'approved');
                
                // Rule disabling logic
                const isAlreadyClaimed = rule.isRepeating ? isApprovedToday : isCompletedEver;
                const isRuleDisabled = submittingId === rule.id || !!pendingSubmission || isRejectedToday || isAlreadyClaimed;

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
                      ) : isAlreadyClaimed ? (
                        <span className="text-xs font-black uppercase tracking-widest bg-green-50 text-green-600 px-3 py-1.5 rounded-full whitespace-nowrap border border-green-100">
                          {rule.isRepeating ? '今日已完成' : '已达成成就'}
                        </span>
                      ) : (
                        <Check size={20} />
                      )}
                   </div>
                </button>
                );
              })}
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
                       <img 
                         src={`https://picsum.photos/seed/${item.id}/600/400`} 
                         alt={item.title}
                         className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                         referrerPolicy="no-referrer"
                       />
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
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
              {rejectedTasks.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={14} /> 
                    需要加油的地方
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
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showNotifCenter && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowNotifCenter(false)} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
             <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-[3rem] p-8 max-w-md w-full relative z-10 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black text-gray-900">消息盒子</h2>
                  <button onClick={() => setShowNotifCenter(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                   {('Notification' in window && Notification.permission !== 'granted') && (
                     <button 
                       onClick={() => requestNotificationPermission().then(() => fetchData())}
                       className="w-full p-4 bg-brand-light text-brand rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-brand hover:text-white transition-all"
                     >
                       <Bell size={16} />
                       开启浏览器实时通知
                     </button>
                   )}
                   {notifications.map(notif => (
                     <div key={notif.id} className={`p-5 rounded-[2rem] border ${notif.isRead ? 'bg-gray-50/50 border-gray-100' : 'bg-white border-brand-light shadow-sm'}`}>
                        <p className="font-black text-sm text-gray-900 mb-1">{notif.title}</p>
                        <p className="text-sm text-gray-600 font-medium">{notif.message}</p>
                     </div>
                   ))}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCelebration && celebratedReward && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-brand/90 backdrop-blur-xl"
          >
            <motion.div initial={{ scale: 0.5, y: 100 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-[4rem] p-12 max-w-lg w-full text-center shadow-2xl relative">
              <div className="relative mb-6">
                 <div className="w-32 h-32 mx-auto rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                    <img 
                      src={`https://picsum.photos/seed/${celebratedReward.id}/400/400`} 
                      alt={celebratedReward.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                 </div>
                 <motion.div 
                   animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                   transition={{ repeat: Infinity, duration: 2 }}
                   className="absolute -top-4 -right-4 bg-yellow-400 p-3 rounded-2xl text-white shadow-lg"
                 >
                    <Sparkles size={24} />
                 </motion.div>
              </div>
              <h2 className="text-4xl font-black text-gray-900 mb-2">好消息！</h2>
              <p className="text-brand font-black text-xl mb-8">爸爸妈妈同意啦！快去领取你的 <span className="text-secondary underline decoration-4 underline-offset-4">{celebratedReward.title}</span> 吧！</p>
              <button 
                onClick={() => setShowCelebration(false)}
                className="w-full bg-brand text-white py-6 rounded-[2.2rem] font-black text-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all"
              >
                太棒了，出发！
              </button>
            </motion.div>
          </motion.div>
        )}

        {showAchievementCelebration && celebratedAchievement && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-orange-500/95 backdrop-blur-[20px]"
          >
            <motion.div initial={{ scale: 0.8, rotate: -5 }} animate={{ scale: 1, rotate: 0 }} className="bg-white rounded-[4rem] p-10 max-w-lg w-full text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative overflow-hidden">
               {/* Background shine effect */}
               <div className="absolute inset-0 bg-gradient-to-tr from-orange-50 to-white opacity-50 -z-10" />
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                 className="absolute -top-20 -left-20 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl -z-10"
               />

               <div className="relative mb-8 pt-4">
                  <motion.div
                    animate={{ y: [0, -15, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="relative z-10"
                  >
                    <Trophy size={100} className="mx-auto text-orange-500" strokeWidth={2.5} />
                  </motion.div>
                  
                  {/* Floating sparkles */}
                  <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="absolute top-0 right-1/4 text-yellow-500">
                    <Sparkles size={24} />
                  </motion.div>
                  <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.7 }} className="absolute bottom-4 left-1/4 text-yellow-500">
                    <Sparkles size={20} />
                  </motion.div>
               </div>

               <h2 className="text-3xl font-black text-gray-900 mb-2">哇！太牛啦！</h2>
               <p className="text-gray-500 font-bold text-lg mb-2">你成功解锁了特别成就</p>
               <div className="bg-orange-50 inline-block px-8 py-4 rounded-3xl mb-8 border-2 border-orange-100">
                 <h3 className="text-2xl font-black text-orange-600 tracking-tight">{celebratedAchievement.title}</h3>
               </div>

               <p className="text-gray-400 font-medium mb-10 px-8">每一步努力都被爸爸妈妈看在眼里哦！你真是太棒了！</p>
               
               <button 
                 onClick={() => setShowAchievementCelebration(false)}
                 className="w-full bg-orange-500 text-white py-6 rounded-[2.2rem] font-black text-2xl shadow-[0_12px_32px_-8px_rgba(249,115,22,0.5)] hover:bg-orange-600 active:scale-95 transition-all"
               >
                 收下荣誉！
               </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
