-- Note: otp_attempts table intentionally has no RLS policies
-- This table is only accessed by Edge Functions using the service role key
-- Adding policies would break the rate limiting functionality
-- The service role bypasses RLS entirely, so policies are not needed

-- Add a comment to document this design decision
COMMENT ON TABLE public.otp_attempts IS 'Rate limiting table for OTP verification. Accessed only via Edge Functions using service role key. RLS enabled but no policies needed as service role bypasses RLS.';