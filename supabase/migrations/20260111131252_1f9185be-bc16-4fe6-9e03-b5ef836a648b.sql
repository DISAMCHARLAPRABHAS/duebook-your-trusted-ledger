-- Create a function to handle new user registration
-- This runs as SECURITY DEFINER to bypass RLS during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_full_name TEXT;
  user_mobile TEXT;
  user_role app_role;
BEGIN
  -- Extract metadata from the user
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  user_mobile := COALESCE(NEW.raw_user_meta_data->>'mobile', '');
  user_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'seller'::app_role);

  -- Insert profile (ignore if exists)
  INSERT INTO public.profiles (id, mobile, full_name)
  VALUES (NEW.id, user_mobile, user_full_name)
  ON CONFLICT (id) DO UPDATE SET
    mobile = EXCLUDED.mobile,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Insert role (ignore if exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to auto-create profile and role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add unique constraint on user_roles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;