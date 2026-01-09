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
  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('seller');
  const [loading, setLoading] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  
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
      const response = await supabase.functions.invoke('send-otp', {
        body: { mobile, countryCode },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send OTP');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ 
        title: 'OTP Sent!', 
        description: `Verification code sent to ${countryCode}${mobile}` 
      });
      setStep('otp');
    } catch (error: unknown) {
      console.error('OTP Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to send OTP';
      toast({ 
        title: 'Failed to send OTP', 
        description: message,
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
      const response = await supabase.functions.invoke('verify-otp', {
        body: { mobile, otp, countryCode },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Verification failed');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const { userId, hasProfile, isExistingCustomer, customerName: existingName, email } = response.data;
      
      // Sign in with magic link token
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      // If user has profile, auth state change will redirect
      if (hasProfile) {
        toast({ title: 'Welcome back!' });
        return;
      }

      // If existing customer, auto-register
      if (isExistingCustomer && existingName) {
        setVerifiedUserId(userId);
        setCustomerName(existingName);
        await createProfile(userId, existingName, 'customer');
        return;
      }

      // New user - show registration
      setVerifiedUserId(userId);
      setStep('register');
    } catch (error: unknown) {
      console.error('Verify Error:', error);
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast({ 
        title: 'Verification failed', 
        description: message,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (userId: string, name: string, role: AppRole) => {
    try {
      const response = await supabase.functions.invoke('create-profile', {
        body: { userId, mobile, fullName: name, role },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create profile');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({ title: 'Account created successfully!' });
      
      // Redirect based on role
      if (role === 'seller') {
        navigate('/seller/dashboard', { replace: true });
      } else {
        navigate('/customer/dashboard', { replace: true });
      }
    } catch (error: unknown) {
      console.error('Profile Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create profile';
      toast({ 
        title: 'Failed to complete registration', 
        description: message,
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
      if (verifiedUserId) {
        await createProfile(verifiedUserId, fullName, selectedRole);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await createProfile(user.id, fullName, selectedRole);
        }
      }
    } catch (error: unknown) {
      console.error('Register Error:', error);
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast({ 
        title: 'Registration failed', 
        description: message,
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
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="flex h-12 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+971">🇦🇪 +971</option>
                      </select>
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="Enter mobile number"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="text-lg flex-1"
                      />
                    </div>
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
                    <span className="font-medium text-foreground">{countryCode}{mobile}</span>
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

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="text-sm text-primary hover:underline transition-colors disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('phone'); setOtp(''); }}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Change mobile number
                    </button>
                  </div>
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
