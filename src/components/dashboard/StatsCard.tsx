'use client';

import { Card } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
}: StatsCardProps) {
  const variantStyles = {
    default: 'text-white',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <Card className="p-4 bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-400">{title}</p>
          <p className={`text-2xl font-bold ${variantStyles[variant]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-zinc-500">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              <svg 
                className={`w-3 h-3 ${trend.isPositive ? '' : 'rotate-180'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <span>{Math.abs(trend.value)}% from last month</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
