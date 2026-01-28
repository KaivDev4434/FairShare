'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';

interface LandingPageProps {
  onGuestContinue: () => void;
}

export function LandingPage({ onGuestContinue }: LandingPageProps) {
  const [animationPhase, setAnimationPhase] = useState<'logo' | 'expand' | 'complete'>('logo');

  useEffect(() => {
    // Phase 1: Show logo (1s)
    const expandTimer = setTimeout(() => setAnimationPhase('expand'), 1000);
    // Phase 2: Expand animation (1.2s) then complete
    const completeTimer = setTimeout(() => setAnimationPhase('complete'), 2200);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0">
        {/* Floating orbs */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
            top: '-10%',
            right: '-10%',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, transparent 70%)',
            bottom: '-5%',
            left: '-10%',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo Animation Container */}
        <motion.div
          className="flex flex-col items-center"
          animate={{
            y: animationPhase === 'complete' ? -80 : 0,
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* The Logo */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* Logo Icon */}
            <motion.div
              className="relative"
              animate={{
                scale: animationPhase === 'logo' ? 1.5 : 1,
              }}
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <motion.div
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
                animate={{
                  rotate: animationPhase === 'expand' ? [0, -5, 0] : 0,
                }}
                transition={{ duration: 0.4 }}
              >
                <span className="text-4xl md:text-5xl font-black text-white tracking-tight">F</span>
              </motion.div>
              
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 blur-xl"
                initial={{ opacity: 0.5 }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{ zIndex: -1 }}
              />
            </motion.div>

            {/* Text that expands from logo */}
            <AnimatePresence>
              {animationPhase !== 'logo' && (
                <motion.div
                  className="overflow-hidden ml-4"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <motion.h1
                    className="text-5xl md:text-7xl font-black tracking-tight whitespace-nowrap"
                    initial={{ x: -20 }}
                    animate={{ x: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    <span className="bg-gradient-to-r from-white via-emerald-100 to-emerald-200 bg-clip-text text-transparent">
                      air
                    </span>
                    <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      Share
                    </span>
                  </motion.h1>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Tagline */}
          <AnimatePresence>
            {animationPhase === 'complete' && (
              <motion.p
                className="mt-6 text-lg md:text-xl text-zinc-400 text-center max-w-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Split bills fairly. No awkward math.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sign In Options */}
        <AnimatePresence>
          {animationPhase === 'complete' && (
            <motion.div
              className="mt-12 w-full max-w-sm space-y-4"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {/* Google Sign In */}
              <motion.button
                onClick={() => signIn('google')}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white text-zinc-900 font-semibold text-lg shadow-lg shadow-white/10 hover:shadow-xl hover:shadow-white/20 transition-all duration-300 group"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </motion.button>

              {/* GitHub Sign In */}
              <motion.button
                onClick={() => signIn('github')}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-zinc-800 text-white font-semibold text-lg border border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600 transition-all duration-300 group"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                <span>Continue with GitHub</span>
              </motion.button>

              {/* Divider */}
              <motion.div
                className="flex items-center gap-4 py-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                <span className="text-zinc-500 text-sm">or</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              </motion.div>

              {/* Guest Continue */}
              <motion.button
                onClick={onGuestContinue}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-transparent text-zinc-400 font-medium border border-zinc-800 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300 group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.8 }}
              >
                <svg 
                  className="w-5 h-5 transition-transform group-hover:translate-x-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span>Continue as Guest</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Preview */}
        <AnimatePresence>
          {animationPhase === 'complete' && (
            <motion.div
              className="mt-16 grid grid-cols-3 gap-8 max-w-2xl"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              {[
                { icon: '📷', title: 'Scan', desc: 'Upload receipts' },
                { icon: '✂️', title: 'Split', desc: 'Claim your items' },
                { icon: '💸', title: 'Settle', desc: 'See who owes what' },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.1 + i * 0.1 }}
                >
                  <div className="text-3xl mb-2">{feature.icon}</div>
                  <div className="font-semibold text-white">{feature.title}</div>
                  <div className="text-sm text-zinc-500">{feature.desc}</div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom decorative line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: animationPhase === 'complete' ? 1 : 0 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
    </div>
  );
}


