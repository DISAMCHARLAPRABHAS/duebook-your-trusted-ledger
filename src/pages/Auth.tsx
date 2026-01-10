import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, Loader2, Store, User, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/types/database';

type AuthMode = 'login' | 'signup';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('seller');
  const [loading, setLoading] = useState(false);
  
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Please enter email and password', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({ title: 'Welcome back!' });
    } catch (error: unknown) {
      console.error('Login Error:', error);
      const message = error instanceof Error ? error.message : 'Login failed';
      toast({ 
        title: 'Login failed', 
        description: message,
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      if (data.user && data.session) {
        // User is signed in, create profile and role
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({ 
            id: data.user.id, 
            mobile: '', 
            full_name: fullName 
          });

        if (profileError) {
          console.error('Profile Error:', profileError);
          throw new Error('Failed to create profile: ' + profileError.message);
        }

        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: data.user.id, 
            role: selectedRole 
          });

        if (roleError) {
          console.error('Role Error:', roleError);
          throw new Error('Failed to create user role: ' + roleError.message);
        }

        toast({ title: 'Account created successfully!' });
        
        // Navigate based on role
        if (selectedRole === 'seller') {
          navigate('/seller/dashboard', { replace: true });
        } else {
          navigate('/customer/dashboard', { replace: true });
        }
      } else if (data.user && !data.session) {
        // Email confirmation required (shouldn't happen with auto-confirm)
        toast({ 
          title: 'Please check your email', 
          description: 'Click the confirmation link to complete signup' 
        });
      }
    } catch (error: unknown) {
      console.error('Signup Error:', error);
      const message = error instanceof Error ? error.message : 'Signup failed';
      toast({ 
        title: 'Signup failed', 
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
            <div className="text-center mb-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-accent flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-muted-foreground">
                {mode === 'login' ? 'Sign in to your account' : 'Sign up to get started'}
              </p>
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-12"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10"
                  />
                </div>
              </div>

              {mode === 'signup' && (
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
              )}

              <Button 
                type="submit" 
                className="w-full h-12 mt-6" 
                disabled={loading || !email || !password || (mode === 'signup' && !fullName.trim())}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setPassword('');
                }}
                className="text-sm text-primary hover:underline transition-colors"
              >
                {mode === 'login' 
                  ? "Don't have an account? Sign up" 
                  : 'Already have an account? Sign in'}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
    </div>
  );
}
