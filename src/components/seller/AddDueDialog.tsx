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
import { useAuth } from '@/contexts/AuthContext';

interface AddDueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onSuccess: () => void;
}

export function AddDueDialog({ open, onOpenChange, customerId, onSuccess }: AddDueDialogProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Reset form with current date when dialog opens
  React.useEffect(() => {
    if (open) {
      setDueDate(new Date().toISOString().split('T')[0]);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Please fill all fields correctly', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('dues').insert({
        customer_id: customerId,
        seller_id: user?.id,
        description: description.trim(),
        amount: amountNum,
        due_date: dueDate || null,
      });

      if (error) throw error;

      toast({ title: 'Due added successfully!' });
      setDescription('');
      setAmount('');
      setDueDate('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Add due error:', error);
      toast({ title: 'Failed to add due', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Due</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="due-description">Description</Label>
            <Textarea
              id="due-description"
              placeholder="What is this due for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-amount">Amount (₹)</Label>
            <Input
              id="due-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Due'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
