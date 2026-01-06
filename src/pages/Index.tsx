import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, Store, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'seller') {
        navigate('/seller/dashboard', { replace: true });
      } else {
        navigate('/customer/dashboard', { replace: true });
      }
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-border">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">DueBook</span>
          </div>
          <Button onClick={() => navigate('/auth')}>
            Login <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md animate-slide-up">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Shield className="h-10 w-10 text-primary" />
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Simple Due Tracking for Your Business
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Track customer dues, record payments, and manage your shop's finances effortlessly.
          </p>

          <Button size="lg" className="w-full sm:w-auto" onClick={() => navigate('/auth')}>
            Get Started <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-lg mt-16 w-full">
          <div className="bg-card rounded-xl p-5 shadow-soft border border-border text-left">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-3">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">For Shop Owners</h3>
            <p className="text-sm text-muted-foreground">
              Add customers, track dues, and record payments in one place.
            </p>
          </div>

          <div className="bg-card rounded-xl p-5 shadow-soft border border-border text-left">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center mb-3">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">For Customers</h3>
            <p className="text-sm text-muted-foreground">
              View your dues from all shops in one dashboard.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-border text-center text-sm text-muted-foreground">
        © 2026 DueBook. All rights reserved.
      </footer>
    </div>
  );
}
