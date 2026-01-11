-- Drop the unique constraint on mobile if it exists (users may have empty mobile during signup)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_mobile_key;