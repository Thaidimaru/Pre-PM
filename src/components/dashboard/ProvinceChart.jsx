import React from 'react';
import { MapPin, BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

export function ProvinceChart({ provinces = [] }) {
  const maxProvinceCount = Math.max(...provinces.map((p) => p.count), 1);

  return (
    <GlassCard className="flex flex-col h-full" hoverEffect={false}>
      {/* Panel Title */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-800/80">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-300">
          <MapPin className="h-4 w-4" />
        </div>
        <h2 className="text-lg font-bold text-white tracking-normal leading-normal">
          สรุปผลการสำรวจรายจังหวัด
        </h2>
      </div>

      {/* Map & Province Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 flex-1">
        {/* Thailand Map & Radar Pulses */}
        <div className="lg:col-span-5 relative flex items-center justify-center min-h-[300px] rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-blue-900/20 to-transparent pointer-events-none" />
          <img
            src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Thailand_provinces_th.svg"
            alt="แผนที่ประเทศไทยแบ่งจังหวัด"
            loading="lazy"
            className="h-full max-h-[340px] w-auto object-contain opacity-80 filter grayscale invert contrast-125 brightness-110 mix-blend-screen drop-shadow-md"
          />

          {/* Pulsing Radar Markers */}
          {/* North */}
          <div className="absolute top-[22%] left-[42%]" title="ภาคเหนือ">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_8px_#24b8ff]" />
            </span>
          </div>
          {/* Central / East */}
          <div className="absolute top-[48%] left-[48%]" title="ภาคกลาง / ตะวันออก">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 shadow-[0_0_8px_#087fff]" />
            </span>
          </div>
          {/* South */}
          <div className="absolute top-[75%] left-[44%]" title="ภาคใต้">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_#00d49a]" />
            </span>
          </div>
          {/* Northeast */}
          <div className="absolute top-[35%] left-[62%]" title="ภาคอีสาน">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500 shadow-[0_0_8px_#8b5cf6]" />
            </span>
          </div>
        </div>

        {/* Province List Ranking */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/30">
            <div className="grid grid-cols-12 gap-2 bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-400 border-b border-slate-800/80">
              <span className="col-span-1">#</span>
              <span className="col-span-4">จังหวัด</span>
              <span className="col-span-5">สัดส่วน</span>
              <span className="col-span-2 text-right">รวม</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-800/40">
              {provinces.length > 0 ? (
                provinces.map((prov, i) => {
                  const pct = Math.max(10, Math.min(100, (prov.count / maxProvinceCount) * 100));
                  return (
                    <div
                      key={prov.name}
                      className="grid grid-cols-12 gap-2 items-center px-4 py-2 text-sm hover:bg-slate-800/30 transition-colors"
                    >
                      <span className="col-span-1 text-slate-400 text-xs font-mono">{i + 1}.</span>
                      <span className="col-span-4 font-medium text-slate-200 truncate" title={prov.name}>
                        {prov.name}
                      </span>
                      <div className="col-span-5 flex items-center pr-2">
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="col-span-2 text-right font-mono font-bold text-cyan-300">
                        {prov.count.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-sm text-slate-500">
                  ยังไม่มีข้อมูลจังหวัด
                </div>
              )}
            </div>
          </div>

          {/* Map Legend */}
          <div className="flex items-center justify-center gap-6 pt-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00d49a]" />
              <span>อนุญาต</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_6px_#ff4f67]" />
              <span>ไม่อนุญาต</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_#8b5cf6]" />
              <span>รอพิจารณา</span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
