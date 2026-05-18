/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Star,
  Gift,
  Zap,
  Smile,
  Sparkles,
  Heart,
  Trophy,
  Rocket
} from 'lucide-react';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const steps: Step[] = [
  {
    icon: <Heart size={48} />,
    title: '欢迎来到 KiddieRewards',
    description: '这是一个家庭积分奖励系统，帮助家长通过积分激励孩子养成好习惯、完成任务，让成长变得更有趣！',
    color: 'bg-brand text-white',
  },
  {
    icon: <Star size={48} />,
    title: '家长：创建任务与奖励',
    description: '家长可以创建日常任务（如"自己刷牙"）或一次性成就（如"考试100分"），并设置对应的积分奖励。还可以设置愿望清单，让孩子用积分兑换想要的奖励。',
    color: 'bg-secondary text-white',
  },
  {
    icon: <Zap size={48} />,
    title: '孩子：完成任务赚积分',
    description: '孩子在任务列表中看到家长布置的任务，完成后提交申请，家长审批通过后自动获得积分。积累足够积分后，就可以兑换自己心仪的奖励！',
    color: 'bg-green-500 text-white',
  },
  {
    icon: <Rocket size={48} />,
    title: '开始使用',
    description: '已经有家庭账号？输入 "你的名字@家庭名" 登录。还没有账号？在登录页点击「注册新家庭」即可创建，邀请家人一起加入！',
    color: 'bg-purple-500 text-white',
  },
];

export const OnboardingGuide = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(0);
  const total = steps.length;
  const current = steps[step];

  const handleClose = () => {
    localStorage.setItem('kiddie_onboarding_done', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white rounded-[2.5rem] p-8 max-w-md w-full relative z-10 shadow-2xl"
      >
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
        >
          <X size={20} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="text-center"
          >
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 ${current.color}`}>
              {current.icon}
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">{current.title}</h2>
            <p className="text-gray-500 font-medium leading-relaxed">{current.description}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-2 mt-8 mb-6">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-brand' : 'w-2 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-3 text-gray-400 font-bold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            上一步
          </button>

          {step < total - 1 ? (
            <button
              onClick={() => setStep(Math.min(total - 1, step + 1))}
              className="flex items-center gap-1 px-6 py-3 bg-brand text-white font-black rounded-xl shadow-lg shadow-brand-light hover:bg-brand-hover transition-all active:scale-95"
            >
              下一步
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="flex items-center gap-1 px-6 py-3 bg-green-500 text-white font-black rounded-xl shadow-lg shadow-green-300 hover:bg-green-600 transition-all active:scale-95"
            >
              <Sparkles size={18} />
              开始使用
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
