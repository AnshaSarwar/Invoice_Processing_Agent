"use client";

import { Stats } from '../api';

interface StatsCardsProps {
  stats: Stats | null;
}

const cards = [
  {
    key: 'total',
    label: 'Total Processed',
    icon: '📄',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.08))',
    border: 'rgba(59,130,246,0.25)',
    color: '#93c5fd',
  },
  {
    key: 'successful',
    label: 'Matched',
    icon: '✅',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))',
    border: 'rgba(34,197,94,0.25)',
    color: '#86efac',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: '❌',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(244,63,94,0.08))',
    border: 'rgba(239,68,68,0.25)',
    color: '#fca5a5',
  },
  {
    key: 'avg_time',
    label: 'Avg. Time',
    icon: '⏱️',
    gradient: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(139,92,246,0.08))',
    border: 'rgba(168,85,247,0.25)',
    color: '#c4b5fd',
    suffix: 's',
  },
] as const;

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const raw = stats ? stats[card.key as keyof Stats] : 0;
        const value = card.key === 'avg_time' ? (raw ?? 0).toFixed(1) : (raw ?? 0);

        return (
          <div
            key={card.key}
            className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] group"
            style={{
              background: card.gradient,
              border: `1px solid ${card.border}`,
            }}
          >
            {/* Glow effect */}
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-500"
              style={{ background: card.color, filter: 'blur(20px)' }}
            />

            <span className="text-2xl block mb-3">{card.icon}</span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
              {card.label}
            </p>
            <p className="text-3xl font-black tracking-tight" style={{ color: card.color }}>
              {value}{'suffix' in card ? card.suffix : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}
