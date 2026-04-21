import React, { useState } from 'react';
import { 
  Star, 
  User, 
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '../../types';

export const LoginView = ({ onLogin }: { onLogin: (u: UserProfile) => void }) => {
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
