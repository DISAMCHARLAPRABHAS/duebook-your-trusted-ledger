import React from 'react';
import { ChevronRight, Phone } from 'lucide-react';
import { CustomerWithDues } from '@/types/database';
import { cn } from '@/lib/utils';

interface CustomerCardProps {
  customer: CustomerWithDues;
  onClick: () => void;
}

export function CustomerCard({ customer, onClick }: CustomerCardProps) {
  const pendingAmount = customer.total_due - customer.total_paid;
  const isPaid = pendingAmount <= 0;

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-xl p-4 shadow-soft border border-border hover:shadow-medium hover:border-primary/20 transition-all text-left animate-slide-up"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{customer.name}</h3>
            {isPaid && (
              <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-medium rounded-full">
                Paid
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            <span>{customer.mobile}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={cn(
              'text-lg font-bold',
              isPaid ? 'text-success' : 'text-destructive'
            )}>
              ₹{pendingAmount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">pending</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}
