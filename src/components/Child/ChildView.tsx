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

export const ChildView = ({ user, socket }: { user: UserProfile, socket: Socket | null }) => {
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
          parentId: user.parentId || 'p1', 
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
              <PartyPopper size={80} className="mx-auto text-brand mb-6" />
              <h2 className="text-4xl font-black text-gray-900 mb-2">哇！太棒了！</h2>
              <p className="text-brand font-black text-xl mb-8">成功兑换了 {celebratedReward.title}</p>
              <button 
                onClick={() => setShowCelebration(false)}
                className="w-full bg-brand text-white py-6 rounded-[2.2rem] font-black text-2xl"
              >
                知道啦！
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
