import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddCustomerDialog({ open, onOpenChange, onSuccess }: AddCustomerDialogProps) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || mobile.length < 10) {
      toast({ title: 'Please fill all fields correctly', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('customers').insert({
        seller_id: user?.id,
        name: name.trim(),
        mobile,
      });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Customer with this mobile already exists', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'Customer added successfully!' });
      setName('');
      setMobile('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Add customer error:', error);
      toast({ title: 'Failed to add customer', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name</Label>
            <Input
              id="customer-name"
              placeholder="Enter customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-mobile">Mobile Number</Label>
            <Input
              id="customer-mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
