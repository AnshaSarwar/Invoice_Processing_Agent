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
    gradient: '#f8fafc',
    border: '#e2e8f0',
    color: '#2563eb',
  },
  {
    key: 'successful',
    label: 'Matched',
    icon: '✅',
    gradient: '#f0fdf4',
    border: '#dcfce7',
    color: '#16a34a',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: '❌',
    gradient: '#fef2f2',
    border: '#fee2e2',
    color: '#dc2626',
  },
  {
    key: 'avg_time',
    label: 'Avg. Time',
    icon: '⏱️',
    gradient: '#faf5ff',
    border: '#f3e8ff',
    color: '#9333ea',
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
            className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:shadow-md group border"
            style={{
              backgroundColor: card.gradient,
              borderColor: card.border,
            }}
          >
            {/* pulse icon */}
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl mb-3 shadow-sm border border-zinc-100 group-hover:scale-110 transition-transform">
              {card.icon}
            </div>
            
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1">
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
