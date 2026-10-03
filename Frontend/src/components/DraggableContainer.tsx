import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '../lib/utils';

interface DraggableContainerProps {
  id: string;
  getDragData: () => object;
  dashboardData?: any;
  children: React.ReactNode;
  className?: string;
  badgeText?: string;
  isDraggable?: boolean;
  key?: string | number;
}

export function DraggableContainer({
  id,
  getDragData,
  dashboardData,
  children,
  className = '',
  badgeText = 'Drag to AI',
  isDraggable = true
}: DraggableContainerProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) return;
        const data = { ...getDragData(), fullDashboardContext: dashboardData };
        e.dataTransfer.setData('application/x-dashboard-context', JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'copy';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        "group relative transition-all duration-300",
        isDraggable && "cursor-grab active:cursor-grabbing",
        dragging ? "opacity-40 scale-95 rotate-1 grayscale" : "hover:scale-[1.01]",
        className
      )}
    >
      {/* Hover glow ring */}
      <div className="absolute -inset-[2px] rounded-2xl border-2 border-transparent group-hover:border-[var(--brand)]/60 group-hover:shadow-[0_0_20px_var(--brand)]/20 transition-all duration-300 pointer-events-none z-10" />
      
      {children}
      
      {/* Top-left badge */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300 pointer-events-none select-none z-20">
        <Bot className="w-3.5 h-3.5 animate-pulse" />
        <span className="tracking-wide uppercase">{badgeText}</span>
      </div>
    </div>
  );
}
