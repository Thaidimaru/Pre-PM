import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ShieldCheck, Radio } from 'lucide-react';
import { APP_VERSION } from '@/version';

export function Navbar() {
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(
        new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="sticky top-0 z-40 h-[88px] w-full border-b border-[rgba(28,139,255,0.45)] bg-[linear-gradient(90deg,#021735,#031b40)] shadow-[0_8px_30px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="mx-auto flex h-full items-center justify-between px-6 lg:px-10">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <img
            src="/assets/images/nbtc-logo-dashboard.png"
            alt="NBTC Logo"
            className="h-14 w-auto object-contain drop-shadow-[0_0_12px_rgba(8,127,255,0.3)]"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-[0.2em] text-cyan-400">
                SURVEY CONTROL ROOM
              </span>
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300 border border-blue-500/30">
                v{APP_VERSION}
              </span>
            </div>
            <span className="text-lg font-extrabold tracking-wide text-white lg:text-xl">
              NBTC MICROWAVE
            </span>
          </div>
        </div>

        {/* Live System Strip */}
        <div className="hidden md:flex items-center gap-4 text-sm text-slate-300">
          {/* Online status indicator */}
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium">ระบบทำงานปกติ</span>
          </div>

          <div className="h-6 w-px bg-slate-700/60" />

          {/* Date & Time */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span>{dateStr}</span>
          </div>

          <div className="flex items-center gap-2 font-mono font-semibold text-white">
            <Clock className="h-4 w-4 text-blue-400" />
            <span>{timeStr} น.</span>
          </div>

          <div className="h-6 w-px bg-slate-700/60" />

          {/* User profile */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(8,127,255,0.4)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-left leading-tight">
              <div className="text-xs font-semibold text-white">ผู้ดูแลระบบ</div>
              <div className="text-[10px] text-slate-400">Administrator</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
