import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Due } from '@/types/database';

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  due: Due;
  onSuccess: () => void;
}

export function RecordPaymentDialog({ open, onOpenChange, due, onSuccess }: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const remainingAmount = due.amount - due.paid_amount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    if (amountNum > remainingAmount) {
      toast({ title: 'Amount cannot exceed remaining balance', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('payments').insert({
        due_id: due.id,
        amount: amountNum,
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast({ title: 'Payment recorded successfully!' });
      setAmount('');
      setNotes('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({ title: 'Failed to record payment', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePayFull = () => {
    setAmount(remainingAmount.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="bg-accent rounded-lg p-3 mb-4">
          <p className="text-sm text-muted-foreground">{due.description}</p>
          <div className="flex justify-between mt-2">
            <span className="text-sm text-muted-foreground">Remaining:</span>
            <span className="font-bold text-foreground">₹{remainingAmount.toLocaleString()}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="payment-amount">Payment Amount (₹)</Label>
              <button
                type="button"
                onClick={handlePayFull}
                className="text-xs text-primary hover:underline"
              >
                Pay Full Amount
              </button>
            </div>
            <Input
              id="payment-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              max={remainingAmount}
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes (Optional)</Label>
            <Textarea
              id="payment-notes"
              placeholder="Add payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-success hover:bg-success/90 text-success-foreground" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
