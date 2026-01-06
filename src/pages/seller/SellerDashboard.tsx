import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, IndianRupee, AlertCircle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/seller/StatCard';
import { CustomerCard } from '@/components/seller/CustomerCard';
import { AddCustomerDialog } from '@/components/seller/AddCustomerDialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CustomerWithDues } from '@/types/database';

export default function SellerDashboard() {
  const [customers, setCustomers] = useState<CustomerWithDues[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
    if (user && role === 'seller') {
      fetchCustomers();
    }
  }, [user, role]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Fetch customers with their dues
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      // Fetch dues for all customers
      const { data: duesData, error: duesError } = await supabase
        .from('dues')
        .select('*')
        .eq('seller_id', user?.id);

      if (duesError) throw duesError;

      // Calculate totals for each customer
      const customersWithDues: CustomerWithDues[] = (customersData || []).map(customer => {
        const customerDues = (duesData || []).filter(d => d.customer_id === customer.id);
        const total_due = customerDues.reduce((sum, d) => sum + Number(d.amount), 0);
        const total_paid = customerDues.reduce((sum, d) => sum + Number(d.paid_amount), 0);
        
        return {
          ...customer,
          total_due,
          total_paid,
        };
      });

      setCustomers(customersWithDues);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.mobile.includes(searchQuery)
  );

  const totalDue = customers.reduce((sum, c) => sum + c.total_due, 0);
  const totalPaid = customers.reduce((sum, c) => sum + c.total_paid, 0);
  const totalPending = totalDue - totalPaid;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout title="Overview">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Customers"
          value={customers.length}
          icon={Users}
        />
        <StatCard
          title="Total Outstanding"
          value={`₹${totalPending.toLocaleString()}`}
          icon={IndianRupee}
          variant="destructive"
        />
        <StatCard
          title="Total Collected"
          value={`₹${totalPaid.toLocaleString()}`}
          icon={IndianRupee}
          variant="success"
        />
        <StatCard
          title="Pending Dues"
          value={customers.filter(c => c.total_due > c.total_paid).length}
          subtitle="customers"
          icon={AlertCircle}
          variant="warning"
        />
      </div>

      {/* Search & Add */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddCustomer(true)}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Customer</span>
        </Button>
      </div>

      {/* Customers List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-foreground mb-1">No customers yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first customer to start tracking dues
            </p>
            <Button onClick={() => setShowAddCustomer(true)}>
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onClick={() => navigate(`/seller/customer/${customer.id}`)}
            />
          ))
        )}
      </div>

      <AddCustomerDialog
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onSuccess={fetchCustomers}
      />
    </DashboardLayout>
  );
}
