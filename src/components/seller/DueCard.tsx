import React from 'react';
import { Calendar, CreditCard, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Due } from '@/types/database';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DueCardProps {
  due: Due;
  onRecordPayment: () => void;
  onDelete: () => void;
}

export function DueCard({ due, onRecordPayment, onDelete }: DueCardProps) {
  const remainingAmount = due.amount - due.paid_amount;
  const isPaid = due.status === 'paid';
  const isPartial = due.status === 'partial';

  const statusColors = {
    pending: 'bg-warning/10 text-warning',
    partial: 'bg-primary/10 text-primary',
    paid: 'bg-success/10 text-success',
  };

  return (
    <div className="bg-card rounded-xl p-4 shadow-soft border border-border animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground line-clamp-2">{due.description}</p>
          {due.due_date && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Due: {format(new Date(due.due_date), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>

        {!isPaid && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRecordPayment}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Due
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={cn('text-xs font-medium px-2 py-1 rounded-full', statusColors[due.status])}>
            {due.status.charAt(0).toUpperCase() + due.status.slice(1)}
          </span>
        </div>

        <div className="text-right">
          <p className={cn(
            'text-lg font-bold',
            isPaid ? 'text-success' : 'text-foreground'
          )}>
            ₹{remainingAmount.toLocaleString()}
          </p>
          {isPartial && (
            <p className="text-xs text-muted-foreground">
              of ₹{due.amount.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
