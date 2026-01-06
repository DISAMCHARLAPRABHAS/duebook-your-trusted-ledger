import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Phone, Loader2, FileText, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/seller/StatCard';
import { DueCard } from '@/components/seller/DueCard';
import { AddDueDialog } from '@/components/seller/AddDueDialog';
import { RecordPaymentDialog } from '@/components/seller/RecordPaymentDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Customer, Due } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [dues, setDues] = useState<Due[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDue, setShowAddDue] = useState(false);
  const [selectedDue, setSelectedDue] = useState<Due | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDeleteDue, setShowDeleteDue] = useState(false);
  const [dueToDelete, setDueToDelete] = useState<Due | null>(null);
  
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (role && role !== 'seller') {
        navigate('/customer/dashboard', { replace: true });
      }
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'seller' && id) {
      fetchCustomerData();
    }
  }, [user, role, id]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('seller_id', user?.id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      const { data: duesData, error: duesError } = await supabase
        .from('dues')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (duesError) throw duesError;
      setDues((duesData || []) as Due[]);
    } catch (error) {
      console.error('Error fetching customer:', error);
      navigate('/seller/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDue = async () => {
    if (!dueToDelete) return;

    try {
      const { error } = await supabase
        .from('dues')
        .delete()
        .eq('id', dueToDelete.id);

      if (error) throw error;

      toast({ title: 'Due deleted successfully' });
      fetchCustomerData();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({ title: 'Failed to delete due', variant: 'destructive' });
    } finally {
      setShowDeleteDue(false);
      setDueToDelete(null);
    }
  };

  const totalDue = dues.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalPaid = dues.reduce((sum, d) => sum + Number(d.paid_amount), 0);
  const totalPending = totalDue - totalPaid;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) return null;

  return (
    <DashboardLayout title="Customer Details">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/seller/dashboard')}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="bg-card rounded-xl p-4 shadow-soft border border-border mb-6">
        <h3 className="text-lg font-bold text-foreground">{customer.name}</h3>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span>{customer.mobile}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard title="Total Due" value={`₹${totalDue.toLocaleString()}`} icon={FileText} />
        <StatCard title="Paid" value={`₹${totalPaid.toLocaleString()}`} icon={CheckCircle} variant="success" />
        <StatCard title="Pending" value={`₹${totalPending.toLocaleString()}`} icon={Clock} variant="destructive" />
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-foreground">Dues</h3>
        <Button size="sm" onClick={() => setShowAddDue(true)}>
          <Plus className="h-4 w-4" />
          Add Due
        </Button>
      </div>

      <div className="space-y-3">
        {dues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No dues added yet</p>
          </div>
        ) : (
          dues.map((due) => (
            <DueCard
              key={due.id}
              due={due}
              onRecordPayment={() => {
                setSelectedDue(due);
                setShowPayment(true);
              }}
              onDelete={() => {
                setDueToDelete(due);
                setShowDeleteDue(true);
              }}
            />
          ))
        )}
      </div>

      <AddDueDialog open={showAddDue} onOpenChange={setShowAddDue} customerId={customer.id} onSuccess={fetchCustomerData} />
      {selectedDue && <RecordPaymentDialog open={showPayment} onOpenChange={setShowPayment} due={selectedDue} onSuccess={fetchCustomerData} />}

      <AlertDialog open={showDeleteDue} onOpenChange={setShowDeleteDue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Due</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDue} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
