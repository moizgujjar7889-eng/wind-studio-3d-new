import { Gauge } from 'lucide-react';

interface WindMeterProps {
  level: number; // 0..1
  active: boolean;
}

const LABELS = ['CALM', 'BREEZE', 'GUSTY', 'STRONG', 'STORM'];

export default function WindMeter({ level, active }: WindMeterProps) {
  const pct = Math.round(level * 100);
  const label = LABELS[Math.min(LABELS.length - 1, Math.floor(level * LABELS.length))];
  const angle = -120 + level * 240;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="relative w-44 h-24 overflow-hidden">
        {/* dial ticks */}
        <svg viewBox="0 0 200 110" className="w-full h-full">
          <defs>
            <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="55%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
          </defs>
          {Array.from({ length: 13 }).map((_, i) => {
            const a = (-120 + (i / 12) * 240) * (Math.PI / 180);
            const r1 = 78;
            const r2 = i % 3 === 0 ? 64 : 70;
            const cx = 100;
            const cy = 100;
            return (
              <line
                key={i}
                x1={cx + Math.sin(a) * r1}
                y1={cy - Math.cos(a) * r1}
                x2={cx + Math.sin(a) * r2}
                y2={cy - Math.cos(a) * r2}
                stroke={i / 12 <= level && active ? 'url(#dialGrad)' : '#ffffff30'}
                strokeWidth={i % 3 === 0 ? 3 : 1.5}
                strokeLinecap="round"
              />
            );
          })}
          {/* needle */}
          <g transform={`rotate(${angle} 100 100)`}>
            <line
              x1="100" y1="100" x2="100" y2="34"
              stroke={active ? '#f8fafc' : '#ffffff55'}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="5" fill={active ? '#f8fafc' : '#ffffff55'} />
          </g>
        </svg>
      </div>
      <div className="flex items-baseline gap-2 -mt-9">
        <span
          className={`text-4xl font-bold tabular-nums transition-colors ${active ? 'text-white' : 'text-white/50'}`}
        >
          {pct}
        </span>
        <span className="text-sm text-white/60 font-medium tracking-wide">%</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs tracking-[0.2em] text-white/60 font-semibold">
        <Gauge className="w-3.5 h-3.5" />
        {active ? label : 'STANDBY'}
      </div>
    </div>
  );
}
