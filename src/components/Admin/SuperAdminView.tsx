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
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Settings,
  Lock,
  RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SuperAdminView = ({ onLogout }: { onLogout: () => void }) => {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'families' | 'logs' | 'settings'>('families');
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString().padStart(2, '0') });
  const [currentPage, setCurrentPage] = useState(1);
  const LOGS_PER_PAGE = 15;

  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [pwdStatus, setPwdStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ type: 'idle' });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      setPwdStatus({ type: 'error', message: '两次输入的新密码不一致' });
      return;
    }
    if (passwordForm.new.length < 6) {
      setPwdStatus({ type: 'error', message: '新密码至少6位' });
      return;
    }

    setPwdStatus({ type: 'loading' });
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new
        })
      });
      const data = await res.json();
      if (data.success) {
        setPwdStatus({ type: 'success', message: '密码修改成功' });
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        setPwdStatus({ type: 'error', message: data.error || '修改失败' });
      }
    } catch (e) {
      setPwdStatus({ type: 'error', message: '网络请求错误' });
    }
  };

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

  const fetchLogs = async () => {
    setLogsLoading(true);
    setCurrentPage(1); // Reset to page 1 on filter change
    try {
      const res = await fetch(`/api/admin/logs?year=${logFilter.year}&month=${logFilter.month}`);
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Fetch Logs Error:", e);
    } finally {
      setLogsLoading(false);
    }
  };

  const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const paginatedLogs = logs.slice((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE);

  useEffect(() => {
    if (activeTab === 'families') fetchFamilies();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, logFilter]);

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
    <div className="flex flex-col min-h-screen">
      {/* Sub-header with Tabs */}
      <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-start overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 sm:gap-4 py-4 min-w-max">
            <button 
              onClick={() => setActiveTab('families')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === 'families' ? 'bg-brand text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <LayoutDashboard size={18} />
              家庭管理
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === 'logs' ? 'bg-brand text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <FileSearch size={18} />
              系统日志
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-brand text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <Settings size={18} />
              系统设置
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'families' ? (
          <>
            <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">所有家庭概览</h2>
                <p className="text-gray-500 mt-2">当前共管理 {families.length} 个活跃中心家庭</p>
              </div>
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
                        className="p-3 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">家长数量</span>
                           <span className="text-lg font-black text-gray-900">{f.parents.length} 人</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">孩子数量</span>
                           <span className="text-lg font-black text-gray-900">{f.children.length} 人</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">成员列表</span>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Parents */}
                          {f.parents.map((p: any) => (
                            <div key={p.id} className="bg-brand/5 px-3 py-2 rounded-xl flex items-center gap-2 border border-brand/10">
                              <span className="text-[10px] font-black text-brand uppercase tracking-tighter">家长</span>
                              <span className="text-xs font-black text-gray-700">{p.name}</span>
                            </div>
                          ))}
                          {/* Children */}
                          {f.children.map((c: any) => (
                            <div key={c.id} className="bg-gray-50 px-3 py-2 rounded-xl flex items-center gap-2 border border-gray-100/50">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">孩子</span>
                              <span className="text-xs font-black text-gray-700">{c.name}</span>
                            </div>
                          ))}
                          {f.parents.length === 0 && f.children.length === 0 && (
                            <p className="col-span-full text-center text-xs text-gray-400 py-2 italic font-medium">还没有家庭成员</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : activeTab === 'logs' ? (
          <>
            <header className="mb-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between flex-1 gap-6">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">系统操作日志</h2>
                  <p className="text-gray-500 mt-2 font-medium flex items-center gap-2">
                    <Activity size={16} className="text-brand" />
                    实时监控核心操作与安全事件
                  </p>
                </div>
              </div>
              
              <div className="relative shrink-0">
                <button 
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border-2 border-gray-100 shadow-sm hover:border-brand transition-all group"
                >
                  <Calendar size={18} className="text-brand" />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">选择日志时间</span>
                    <span className="text-sm font-black text-gray-900">{logFilter.year}年 {parseInt(logFilter.month)}月</span>
                  </div>
                  <ChevronRight size={16} className={`text-gray-400 transition-transform ${showDatePicker ? 'rotate-90' : ''}`} />
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl p-6 z-[60]"
                    >
                      <div className="flex items-center justify-between mb-6 bg-gray-50 p-1.5 rounded-2xl">
                        {[2024, 2025, 2026].map(y => (
                          <button
                            key={y}
                            onClick={() => setLogFilter({...logFilter, year: y.toString()})}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                              logFilter.year === y.toString() 
                              ? 'bg-brand text-white shadow-md' 
                              : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            {y}年
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({length: 12}).map((_, i) => {
                          const m = (i+1).toString().padStart(2, '0');
                          const isSelected = logFilter.month === m;
                          return (
                            <button
                              key={m}
                              onClick={() => {
                                setLogFilter({...logFilter, month: m});
                                setShowDatePicker(false);
                              }}
                              className={`py-3 rounded-2xl text-xs font-black transition-all border-2 ${
                                isSelected 
                                ? 'bg-brand/5 border-brand text-brand shadow-sm' 
                                : 'bg-white border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                              }`}
                            >
                              {i+1}月
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </header>

            <div className={`bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden ${logsLoading || logs.length === 0 ? '' : 'sm:border-2'}`}>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">时间</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">级别</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">操作类型</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">执行者</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">详情</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono">
                    {logsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent mx-auto"></div>
                        </td>
                      </tr>
                    ) : paginatedLogs.length > 0 ? (
                      paginatedLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString(undefined, { hour12: false })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-black tracking-widest ${
                              log.level === 'SECURITY' ? 'bg-purple-100 text-purple-600' :
                              log.level === 'ERROR' ? 'bg-red-100 text-red-600' :
                              log.level === 'WARN' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {log.level}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-gray-800 whitespace-nowrap">{log.action}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col min-w-[120px]">
                              <span className="text-sm font-black text-gray-700 truncate">{log.userName || 'System'}</span>
                              <span className="text-xs text-gray-400">{log.ip || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs break-words leading-relaxed">
                            {log.details}
                          </td>
                          <td className="px-6 py-4">
                            {log.success ? (
                              <CheckCircle size={18} className="text-green-500" />
                            ) : (
                              <X size={18} className="text-red-500" />
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center text-gray-300 font-bold italic">该月份暂无日志记录</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-gray-100">
                {logsLoading ? (
                  <div className="py-20 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent mx-auto"></div>
                  </div>
                ) : paginatedLogs.length > 0 ? (
                  paginatedLogs.map((log, i) => (
                    <div key={i} className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black tracking-widest ${
                          log.level === 'SECURITY' ? 'bg-purple-100 text-purple-600' :
                          log.level === 'ERROR' ? 'bg-red-100 text-red-600' :
                          log.level === 'WARN' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {log.level}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {log.success ? (
                            <div className="w-5 h-5 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                              <CheckCircle size={12} />
                            </div>
                          ) : (
                            <div className="w-5 h-5 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                              <X size={12} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-lg font-black text-gray-900 mb-1">{log.action}</h4>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed">{log.details}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                            <Users size={12} />
                          </div>
                          <span className="text-[10px] font-black text-gray-600">{log.userName || 'System'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">{log.ip || '-'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-gray-300 font-bold italic">该月份暂无日志记录</div>
                )}
              </div>

              {/* Pagination Controls */}
              {logs.length > LOGS_PER_PAGE && (
                <div className="bg-gray-50/50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    第 {currentPage} / {totalPages} 页 (共 {logs.length} 条)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 disabled:opacity-30 hover:text-brand"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 disabled:opacity-30 hover:text-brand"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex items-center px-4 bg-white border border-gray-100 rounded-lg h-9">
                      <span className="text-xs font-black text-gray-900">{currentPage}</span>
                    </div>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 disabled:opacity-30 hover:text-brand"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="p-2 bg-white rounded-lg border border-gray-100 text-gray-400 disabled:opacity-30 hover:text-brand"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="w-full">
            <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">系统设置</h2>
                <p className="text-gray-500 mt-2 font-medium flex items-center gap-2">
                  <Settings size={16} className="text-brand" />
                  维护后台系统安全性与凭据
                </p>
              </div>
            </header>

            <div className="bg-white rounded-[2.5rem] border-2 border-gray-100 shadow-sm p-8 sm:p-12 max-w-2xl">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 bg-brand/10 rounded-[1.5rem] flex items-center justify-center text-brand">
                  <Lock size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 leading-tight">修改管理员密码</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">SUPER ADMIN CREDENTIALS</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">当前密码</label>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand transition-colors">
                      <Lock size={20} />
                    </div>
                    <input 
                      type="password"
                      required
                      value={passwordForm.current}
                      onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                      placeholder="请输入原密码"
                      className="w-full pl-14 pr-6 py-5 bg-gray-50 border-2 border-transparent focus:border-brand focus:bg-white rounded-2xl outline-none font-sans font-black text-lg transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">新密码</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.new}
                      onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                      placeholder="至少6位"
                      className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-brand focus:bg-white rounded-2xl outline-none font-sans font-black text-lg transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">确认新密码</label>
                    <input 
                      type="password"
                      required
                      value={passwordForm.confirm}
                      onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                      placeholder="再次输入"
                      className="w-full px-6 py-5 bg-gray-50 border-2 border-transparent focus:border-brand focus:bg-white rounded-2xl outline-none font-sans font-black text-lg transition-all"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {pwdStatus.type !== 'idle' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
                        pwdStatus.type === 'success' ? 'bg-green-50 text-green-600' : 
                        pwdStatus.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {pwdStatus.type === 'loading' && <RotateCw size={16} className="animate-spin" />}
                      {pwdStatus.type === 'success' && <CheckCircle size={16} />}
                      {pwdStatus.type === 'error' && <ShieldAlert size={16} />}
                      {pwdStatus.message || (pwdStatus.type === 'loading' ? '正在提交...' : '')}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  type="submit"
                  disabled={pwdStatus.type === 'loading'}
                  className="w-full bg-brand text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-brand-light hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  确认修改
                </button>
              </form>
            </div>
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
