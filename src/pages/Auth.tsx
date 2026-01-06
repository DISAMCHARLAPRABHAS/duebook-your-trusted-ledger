import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, Loader2, Store, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OTPInput } from '@/components/auth/OTPInput';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/types/database';

type AuthStep = 'phone' | 'otp' | 'register';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('phone');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('seller');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && role) {
      if (role === 'seller') {
        navigate('/seller/dashboard', { replace: true });
      } else {
        navigate('/customer/dashboard', { replace: true });
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      toast({ title: 'Please enter a valid mobile number', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Check if user exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('mobile', mobile)
        .maybeSingle();

      setIsNewUser(!existingProfile);

      // For demo purposes, we'll use email-based auth with mobile as email
      const email = `${mobile}@duebook.app`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast({ 
        title: 'OTP Sent!', 
        description: 'Check your email for the verification code (demo mode)' 
      });
      setStep('otp');
    } catch (error: any) {
      console.error('OTP Error:', error);
      toast({ 
        title: 'Failed to send OTP', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({ title: 'Please enter a valid 6-digit OTP', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const email = `${mobile}@duebook.app`;
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      if (data.user) {
        // Check if user has profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile) {
          // Check if this mobile exists as a customer (auto-registered by seller)
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id, name')
            .eq('mobile', mobile)
            .maybeSingle();

          if (existingCustomer) {
            // Auto-register as customer
            await createProfile(data.user.id, existingCustomer.name, 'customer');
          } else {
            setStep('register');
            return;
          }
        }
      }
    } catch (error: any) {
      console.error('Verify Error:', error);
      toast({ 
        title: 'Verification failed', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (userId: string, name: string, role: AppRole) => {
    try {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: userId, mobile, full_name: name });

      if (profileError) throw profileError;

      // Create role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (roleError) throw roleError;

      toast({ title: 'Account created successfully!' });
      
      // Redirect based on role
      if (role === 'seller') {
        navigate('/seller/dashboard', { replace: true });
      } else {
        navigate('/customer/dashboard', { replace: true });
      }
    } catch (error: any) {
      console.error('Profile Error:', error);
      toast({ 
        title: 'Failed to create profile', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createProfile(user.id, fullName, selectedRole);
      }
    } catch (error: any) {
      console.error('Register Error:', error);
      toast({ 
        title: 'Registration failed', 
        description: error.message,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
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
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">DueBook</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-card rounded-2xl shadow-elevated p-6 sm:p-8">
            {step === 'phone' && (
              <>
                <div className="text-center mb-8">
                  <div className="mx-auto h-16 w-16 rounded-full bg-accent flex items-center justify-center mb-4">
                    <Phone className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to DueBook</h1>
                  <p className="text-muted-foreground">Enter your mobile number to continue</p>
                </div>

                <form onSubmit={handleSendOTP} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="mobile" className="text-sm font-medium">Mobile Number</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="text-lg"
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || mobile.length < 10}>
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Continue <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}

            {step === 'otp' && (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-foreground mb-2">Verify OTP</h1>
                  <p className="text-muted-foreground">
                    Enter the 6-digit code sent to<br />
                    <span className="font-medium text-foreground">{mobile}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <OTPInput value={otp} onChange={setOtp} disabled={loading} />

                  <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Verify & Continue'
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setOtp(''); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change mobile number
                  </button>
                </form>
              </>
            )}

            {step === 'register' && (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-foreground mb-2">Complete Registration</h1>
                  <p className="text-muted-foreground">Tell us a bit about yourself</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">I am a</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRole('seller')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedRole === 'seller'
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <Store className={`h-8 w-8 mx-auto mb-2 ${
                          selectedRole === 'seller' ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <p className={`font-medium text-sm ${
                          selectedRole === 'seller' ? 'text-foreground' : 'text-muted-foreground'
                        }`}>Shop Owner</p>
                        <p className="text-xs text-muted-foreground mt-1">Manage dues & customers</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole('customer')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedRole === 'customer'
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <User className={`h-8 w-8 mx-auto mb-2 ${
                          selectedRole === 'customer' ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <p className={`font-medium text-sm ${
                          selectedRole === 'customer' ? 'text-foreground' : 'text-muted-foreground'
                        }`}>Customer</p>
                        <p className="text-xs text-muted-foreground mt-1">View my dues</p>
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || !fullName.trim()}>
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Complete Registration'
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
    </div>
  );
}
