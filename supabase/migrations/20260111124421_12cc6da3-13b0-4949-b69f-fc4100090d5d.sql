-- Fix #1: Remove overly permissive OTP policy
-- RLS stays enabled but with no policies = only service role can access
DROP POLICY IF EXISTS "Service role can manage OTPs" ON public.otp_verifications;

-- Fix #2: Create otp_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.otp_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile VARCHAR(20) NOT NULL UNIQUE,
  attempts INT DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  locked_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on otp_attempts (no policies = service role only)
ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;

-- Create function to clean up old attempt records (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_otp_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_attempts 
  WHERE last_attempt < NOW() - INTERVAL '24 hours';
END;
$$;