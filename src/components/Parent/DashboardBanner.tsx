import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { UserProfile } from '../../types';

interface DashboardBannerProps {
  user: UserProfile;
  children: UserProfile[];
  onNavigate?: (tab: string) => void;
}

const bannerVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

const greetingVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut', delay: 0.2 }
  }
};

const childCardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1], delay: 0.25 + i * 0.08 }
  })
};

const medalEmojis = ['👑', '🥈', '🥉', '🌟', '💫', '✨'];

export const DashboardBanner: React.FC<DashboardBannerProps> = ({ user, children, onNavigate }) => {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => { setHasAnimated(true); }, []);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const skipAnim = prefersReducedMotion || hasAnimated;
  const sorted = [...children].sort((a, b) => (b.points || 0) - (a.points || 0));
  const displayChildren = sorted.slice(0, 6);

  const renderSingleChild = () => {
    const child = children[0];
    return (
      <motion.div
        variants={childCardVariants}
        initial={skipAnim ? false : 'hidden'}
        animate="visible"
        custom={0}
        className="flex items-center gap-4 bg-white/15 backdrop-blur-sm rounded-2xl p-5 border border-white/10"
      >
        <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl">
          🌟
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm opacity-60 font-semibold">{child.name} · 本月星币</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-3xl sm:text-4xl font-black">{child.points || 0}</span>
            <span className="text-xs sm:text-sm opacity-50 font-semibold">颗</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] sm:text-xs opacity-50 font-semibold">继续加油</p>
          <Sparkles size={18} className="inline-block mt-0.5 opacity-40" />
        </div>
      </motion.div>
    );
  };

  const renderMultiChild = () => {
    const gridCols = displayChildren.length <= 2
      ? 'grid-cols-2'
      : displayChildren.length <= 3
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

    return (
      <>
        <div className={`grid ${gridCols} gap-3`}>
          {displayChildren.map((c, idx) => (
            <motion.div
              key={c.id}
              variants={childCardVariants}
              initial={skipAnim ? false : 'hidden'}
              animate="visible"
              custom={idx}
              className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center text-center border border-white/10"
            >
              <div className="text-2xl sm:text-3xl mb-1.5">{medalEmojis[idx] || '✨'}</div>
              <p
                className="font-black text-sm sm:text-base w-full truncate px-1"
                title={c.name}
              >
                {c.name}
              </p>
              <p className="text-xl sm:text-2xl font-black mt-1">{c.points || 0}</p>
              <p className="text-[10px] sm:text-xs opacity-45 font-medium mt-0.5">颗星币</p>
            </motion.div>
          ))}
        </div>
        {children.length > 6 && (
          <button
            onClick={() => onNavigate?.('family')}
            className="mt-3 text-xs sm:text-sm font-bold opacity-60 hover:opacity-100 transition-opacity inline-flex items-center gap-1"
          >
            查看全部 {children.length} 个孩子 →
          </button>
        )}
      </>
    );
  };

  return (
    <motion.div
      variants={bannerVariants}
      initial={skipAnim ? false : 'hidden'}
      animate="visible"
      className="bg-gradient-to-br from-brand via-purple-500 to-pink-500 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl shadow-brand-light/40 text-white overflow-hidden relative"
    >
      {/* Decorative emoji backgrounds */}
      <div className="absolute -top-6 -right-4 text-7xl sm:text-9xl opacity-[0.07] select-none pointer-events-none">🌟</div>
      <div className="absolute bottom-4 left-8 text-5xl sm:text-7xl opacity-[0.05] select-none pointer-events-none">⭐</div>
      <div className="absolute top-12 right-20 text-4xl sm:text-6xl opacity-[0.05] select-none pointer-events-none hidden sm:block">🎈</div>

      {/* Sparkle particles */}
      {!skipAnim && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute text-lg"
              initial={{
                opacity: 0,
                scale: 0,
                x: '30%',
                y: '50%'
              }}
              animate={{
                opacity: [0, 0.8, 0],
                scale: [0, 1.2, 0],
                x: [`${30 + i * 15}%`, `${70 + i * 5}%`],
                y: [`${20 + i * 15}%`, `${-10 + i * 10}%`]
              }}
              transition={{
                duration: 1.2,
                delay: 0.1 + i * 0.15,
                ease: 'easeOut'
              }}
              style={{ left: `${25 + i * 15}%`, top: '60%' }}
            >
              ✨
            </motion.div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Greeting */}
        <motion.div
          variants={greetingVariants}
          initial={skipAnim ? false : 'hidden'}
          animate="visible"
          className="flex items-center gap-3 sm:gap-4 mb-2"
        >
          <span className="text-3xl sm:text-4xl lg:text-5xl shrink-0">👋</span>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight whitespace-nowrap">
              你好, {user.name}!
            </h1>
            <p className="text-xs sm:text-sm lg:text-base opacity-70 font-medium mt-1 whitespace-nowrap">
              今天也请多多鼓励孩子们吧 ✨
            </p>
          </div>
        </motion.div>

        {/* Child display area */}
        <div className="mt-5 sm:mt-6">
          {children.length === 0 ? (
            <motion.div
              variants={childCardVariants}
              initial={skipAnim ? false : 'hidden'}
              animate="visible"
              custom={0}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center border border-white/8"
            >
              <p className="text-2xl sm:text-3xl mb-2">👨‍👩‍👧‍👦</p>
              <p className="text-sm sm:text-base font-bold opacity-75 mb-3">还没有添加孩子呢~</p>
              <button
                onClick={() => onNavigate?.('family_manage')}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors"
              >
                去添加第一个孩子
              </button>
            </motion.div>
          ) : children.length === 1 ? (
            renderSingleChild()
          ) : (
            renderMultiChild()
          )}
        </div>
      </div>
    </motion.div>
  );
};
