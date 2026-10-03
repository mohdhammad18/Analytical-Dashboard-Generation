import React from 'react';
import { TrendingUp, TrendingDown, Minus, UploadCloud, Video, PlayCircle, Clock, Hash } from 'lucide-react';
import { cn } from '../lib/utils';

export interface KPICardProps {
  value: string | number;
  label: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  title?: string;
}

export function KPICard({ value, label, change, trend = 'neutral', title }: KPICardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const isFloat = typeof numValue === 'number' && !isNaN(numValue) && !Number.isInteger(numValue);

  const formattedValue = isFloat
    ? numValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value;

  const searchStr = (label + ' ' + (title || '')).toLowerCase();
  
  let MainIcon = Hash;
  let iconColorClass = 'text-[var(--text-muted)]';
  let iconBgClass = 'bg-[var(--bg-surface)]';

  if (searchStr.includes('upload')) {
    MainIcon = UploadCloud;
    iconColorClass = 'text-[#00D4AA]';
    iconBgClass = 'bg-[#00D4AA]/10';
  } else if (searchStr.includes('creat')) {
    MainIcon = Video;
    iconColorClass = 'text-[#6C63FF]';
    iconBgClass = 'bg-[#6C63FF]/10';
  } else if (searchStr.includes('publish')) {
    MainIcon = PlayCircle;
    iconColorClass = 'text-[#FF6B6B]';
    iconBgClass = 'bg-[#FF6B6B]/10';
  } else if (searchStr.includes('time') || searchStr.includes('rate') || searchStr.includes('duration')) {
    MainIcon = Clock;
    iconColorClass = 'text-[#F5A623]';
    iconBgClass = 'bg-[#F5A623]/10';
  }

  return (
    <div className="flex flex-col justify-between h-full px-5 py-4">
      {title && <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">{title}</p>}
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-[var(--text-main)] leading-tight truncate" title={String(value)}>{formattedValue}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
        </div>
        
        <div className={`p-2 rounded-lg ${iconBgClass}`}>
          <MainIcon className={`w-5 h-5 ${iconColorClass}`} />
        </div>
      </div>

      {change && (
        <div className={cn(
          "flex items-center gap-1 mt-3 text-xs font-medium",
          trend === 'up' && "text-emerald-500",
          trend === 'down' && "text-rose-500",
          trend === 'neutral' && "text-[var(--text-muted)]",
        )}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
