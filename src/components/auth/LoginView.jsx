import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Radio, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { ShinyText } from '@/components/ui/shiny-text';
import { APP_VERSION } from '@/version';
import { loginUser } from '@/lib/api';
import nbtcLogo from '@/assets/images/nbtc-logo-dashboard.png';

export function LoginView({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const data = await loginUser(password);
      sessionStorage.setItem('surveyToken', data.token);
      onLoginSuccess(data.token);
    } catch (err) {
      setErrorMsg(err.message || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบรหัสผ่าน');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8 sm:p-10 border-blue-500/30" hoverEffect={false}>
          {/* Brand Header */}
          <div className="flex items-center gap-3.5 pb-6 border-b border-slate-800">
            <img
              src={nbtcLogo}
              alt="NBTC Logo"
              onError={(e) => {
                if (e.currentTarget.src !== '/assets/images/nbtc-logo-dashboard.png') {
                  e.currentTarget.src = '/assets/images/nbtc-logo-dashboard.png';
                }
              }}
              className="h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(8,127,255,0.4)]"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-[0.18em] text-cyan-400">
                  SURVEY CONTROL ROOM
                </span>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-blue-300">
                  v{APP_VERSION}
                </span>
              </div>
              <span className="text-base font-extrabold text-white">
                NBTC MICROWAVE
              </span>
            </div>
          </div>

          <div className="mt-6 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              <ShinyText>เข้าสู่ระบบ</ShinyText>
            </h1>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน Dashboard ศูนย์ควบคุม และแบบบันทึกการสำรวจ Field Visit
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-300 mb-1.5">
                รหัสผ่านสำหรับเข้าใช้งาน
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน..."
                  required
                  autoFocus
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.3)] bg-[rgba(6,19,33,0.85)] pl-10 pr-11 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300"
              >
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-blue-500/25 hover:shadow-cyan-500/35 transition-all disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>กำลังตรวจสอบ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Footer note */}
          <div className="mt-6 text-center text-[11px] text-slate-400">
            ระบบความปลอดภัยยืนยันตัวตนด้วยสิทธิ์ประจำสถานี • Pre-PM Platform
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
