import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

export function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  const bgColors = {
    default: 'bg-accent',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
    destructive: 'bg-destructive/10',
  };

  const iconColors = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  };

  return (
    <div className="bg-card rounded-xl p-4 shadow-soft border border-border animate-scale-in">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', bgColors[variant])}>
          <Icon className={cn('h-5 w-5', iconColors[variant])} />
        </div>
      </div>
    </div>
  );
}
