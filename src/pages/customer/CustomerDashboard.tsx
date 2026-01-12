import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, IndianRupee, Loader2, Calendar, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/seller/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Due, SellerInfo } from '@/types/database';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DueWithSeller extends Due {
  sellerName: string;
  shopName: string;
}

export default function CustomerDashboard() {
  const [dues, setDues] = useState<DueWithSeller[]>([]);
  const [sellerBreakdown, setSellerBreakdown] = useState<SellerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (role && role !== 'customer') {
        navigate('/seller/dashboard', { replace: true });
      }
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'customer') {
      fetchUserMobile();
    }
  }, [user, role]);

  const fetchUserMobile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('mobile')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      fetchDues(profile.mobile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

  const fetchDues = async () => {
    try {
      setLoading(true);

      // Fetch dues directly - RLS policy allows customers to view their dues via mobile match
      const { data: duesData, error: duesError } = await supabase
        .from('dues')
        .select('*')
        .order('created_at', { ascending: false });

      if (duesError) throw duesError;

      if (!duesData || duesData.length === 0) {
        setDues([]);
        setSellerBreakdown([]);
        setLoading(false);
        return;
      }

      // Get unique seller IDs from dues
      const sellerIds = [...new Set(duesData.map(d => d.seller_id))];

      // Fetch seller profiles for display names
      const { data: sellerProfiles, error: sellerError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', sellerIds);

      if (sellerError) {
        console.error('Error fetching seller profiles:', sellerError);
      }

      const duesWithSeller: DueWithSeller[] = duesData.map(due => {
        const seller = sellerProfiles?.find(s => s.id === due.seller_id);
        return {
          ...due,
          status: due.status as 'pending' | 'partial' | 'paid',
          sellerName: seller?.full_name || 'Shop',
          shopName: seller?.full_name || 'Shop',
        };
      });

      setDues(duesWithSeller);

      // Build seller breakdown
      const breakdown: SellerInfo[] = sellerIds.map(sellerId => {
        const seller = sellerProfiles?.find(s => s.id === sellerId);
        const sellerDues = duesWithSeller.filter(d => d.seller_id === sellerId);
        return {
          id: sellerId,
          name: seller?.full_name || 'Shop',
          total_due: sellerDues.reduce((sum, d) => sum + Number(d.amount), 0),
          total_paid: sellerDues.reduce((sum, d) => sum + Number(d.paid_amount), 0),
        };
      });

      setSellerBreakdown(breakdown);
    } catch (error) {
      console.error('Error fetching dues:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalDue = dues.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalPaid = dues.reduce((sum, d) => sum + Number(d.paid_amount), 0);
  const totalPending = totalDue - totalPaid;

  const statusColors = {
    pending: 'bg-warning/10 text-warning',
    partial: 'bg-primary/10 text-primary',
    paid: 'bg-success/10 text-success',
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout title="Your Dues">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard title="Total Due" value={`₹${totalPending.toLocaleString()}`} icon={IndianRupee} variant="destructive" />
        <StatCard title="Shops" value={sellerBreakdown.length} icon={Store} />
      </div>

      {sellerBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3">Shop-wise Breakdown</h3>
          <div className="space-y-2">
            {sellerBreakdown.map((seller) => (
              <div key={seller.id} className="bg-card rounded-xl p-4 shadow-soft border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">Paid: ₹{seller.total_paid.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-lg font-bold', seller.total_due - seller.total_paid > 0 ? 'text-destructive' : 'text-success')}>
                      ₹{(seller.total_due - seller.total_paid).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">pending</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-foreground mb-3">Transaction History</h3>
        {dues.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-foreground mb-1">No dues found</h3>
            <p className="text-sm text-muted-foreground">You don't have any dues with any shops</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dues.map((due) => (
              <div key={due.id} className="bg-card rounded-xl p-4 shadow-soft border border-border animate-slide-up">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground line-clamp-1">{due.description}</p>
                    <p className="text-sm text-muted-foreground">{due.shopName}</p>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-1 rounded-full ml-2', statusColors[due.status])}>
                    {due.status.charAt(0).toUpperCase() + due.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{format(new Date(due.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  <p className={cn('font-bold', due.status === 'paid' ? 'text-success' : 'text-foreground')}>
                    ₹{(Number(due.amount) - Number(due.paid_amount)).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
