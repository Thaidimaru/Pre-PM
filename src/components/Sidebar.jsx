import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ClipboardList, LogOut, Radio, Activity } from 'lucide-react';
import { APP_VERSION } from '@/version';
import { cn } from '@/lib/utils';

export function Sidebar({ currentPage, onNavigate, onLogout }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      sublabel: 'ศูนย์ควบคุมภาพรวม',
      icon: LayoutDashboard
    },
    {
      id: 'field',
      label: 'Field Visit',
      sublabel: 'แบบบันทึกตรวจเยี่ยม',
      icon: ClipboardList
    }
  ];

  return (
    <aside className="fixed left-0 top-[88px] z-30 flex h-[calc(100vh-88px)] w-64 flex-col justify-between border-r border-[rgba(28,139,255,0.22)] bg-[linear-gradient(180deg,rgba(2,15,35,0.95),rgba(2,11,27,0.98))] p-4 shadow-xl backdrop-blur-xl transition-all duration-300">
      <div className="space-y-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-cyan-400 uppercase">
            Control Center Menu
          </div>
          <nav className="space-y-1.5" aria-label="แถบเมนูหลัก">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/30 to-cyan-500/15 text-white border border-blue-500/40 shadow-[0_0_20px_rgba(8,127,255,0.2)]'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border border-transparent'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-500/30 text-cyan-300'
                        : 'bg-slate-800/60 text-slate-400 group-hover:text-slate-200'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col leading-normal">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-[11px] text-slate-400 leading-normal">{item.sublabel}</span>
                  </div>

                  {isActive && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      className="absolute right-0 h-6 w-1 rounded-l-full bg-cyan-400 shadow-[0_0_8px_#24b8ff]"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Action button */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onLogout}
            className="group flex w-full items-center gap-3 rounded-xl border border-rose-500/20 px-3.5 py-2.5 text-left text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 group-hover:text-rose-200">
              <LogOut className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">ออกจากระบบ</span>
          </button>
        </div>
      </div>

      {/* Footer Branding & Signal Status */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-3.5 text-center">
        <div className="mb-2 flex items-center justify-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="h-2.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="h-3.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          <span className="h-4.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '450ms' }} />
          <span className="h-5.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '600ms' }} />
        </div>
        <div className="text-xs font-bold tracking-wider text-slate-200">NBTC MICROWAVE</div>
        <div className="text-[11px] text-slate-400">Pre-PM Survey v{APP_VERSION}</div>
      </div>
    </aside>
  );
}
