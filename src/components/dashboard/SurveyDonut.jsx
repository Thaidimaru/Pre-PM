import React from 'react';
import { PieChart } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

export function SurveyDonut({ stats = {} }) {
  const total = stats.surveys || 0;
  const allowed = stats.allowed || 0;
  const denied = stats.denied || 0;
  const pending = Math.max(total - allowed - denied, 0);

  const allowedPct = total > 0 ? (allowed / total) * 100 : 0;
  const deniedPct = total > 0 ? (denied / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;

  const donutGradient =
    total > 0
      ? `conic-gradient(#00d49a 0% ${allowedPct}%, #ff4f67 ${allowedPct}% ${allowedPct + deniedPct}%, #8b5cf6 ${allowedPct + deniedPct}% 100%)`
      : 'conic-gradient(#00d49a 0% 0%, #1e293b 0% 100%)';

  return (
    <GlassCard className="flex flex-col" hoverEffect={false}>
      {/* Panel Title */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-800/80">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
          <PieChart className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-wide">
          สัดส่วนผลการสำรวจ
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-5">
        {/* Donut graphic */}
        <div
          className="relative flex h-36 w-36 items-center justify-center rounded-full p-3 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
          style={{ background: donutGradient }}
        >
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#051326] shadow-inner border border-slate-800">
            <span className="text-xl font-extrabold text-white">
              {allowedPct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400">อนุญาต</span>
          </div>
        </div>

        {/* Breakdown details */}
        <div className="flex w-full flex-col gap-3 sm:max-w-[200px]">
          {/* Allowed */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-200">อนุญาต</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-emerald-400">{allowed.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">({allowedPct.toFixed(0)}%)</span>
            </div>
          </div>

          {/* Denied */}
          <div className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="text-xs font-medium text-slate-200">ไม่อนุญาต</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-rose-400">{denied.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">({deniedPct.toFixed(0)}%)</span>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-950/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
              <span className="text-xs font-medium text-slate-200">รอพิจารณา</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-purple-400">{pending.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">({pendingPct.toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
