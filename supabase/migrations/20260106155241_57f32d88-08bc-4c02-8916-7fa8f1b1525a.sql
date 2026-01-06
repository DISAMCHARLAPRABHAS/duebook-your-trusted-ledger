-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('seller', 'customer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mobile VARCHAR(15) NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create customers table (sellers add customers)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(seller_id, mobile)
);

-- Create dues table
CREATE TABLE public.dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'partial', 'paid')),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  due_id UUID REFERENCES public.dues(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to get customer mobile from profile
CREATE OR REPLACE FUNCTION public.get_user_mobile(_user_id UUID)
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mobile FROM public.profiles WHERE id = _user_id
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role during registration" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Customers policies (sellers can manage their customers)
CREATE POLICY "Sellers can view own customers" ON public.customers
  FOR SELECT USING (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can insert customers" ON public.customers
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can update own customers" ON public.customers
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can delete own customers" ON public.customers
  FOR DELETE USING (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

-- Dues policies
CREATE POLICY "Sellers can view own dues" ON public.dues
  FOR SELECT USING (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

CREATE POLICY "Customers can view their dues by mobile" ON public.dues
  FOR SELECT USING (
    public.has_role(auth.uid(), 'customer') AND
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_id
      AND c.mobile = public.get_user_mobile(auth.uid())
    )
  );

CREATE POLICY "Sellers can insert dues" ON public.dues
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can update own dues" ON public.dues
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

CREATE POLICY "Sellers can delete own dues" ON public.dues
  FOR DELETE USING (
    public.has_role(auth.uid(), 'seller') AND seller_id = auth.uid()
  );

-- Payments policies
CREATE POLICY "Sellers can view payments for their dues" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dues d
      WHERE d.id = due_id AND d.seller_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view payments for their dues" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dues d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = due_id AND c.mobile = public.get_user_mobile(auth.uid())
    )
  );

CREATE POLICY "Sellers can insert payments" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dues d
      WHERE d.id = due_id AND d.seller_id = auth.uid()
    )
  );

-- Trigger to update due status and paid_amount when payment is added
CREATE OR REPLACE FUNCTION public.update_due_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid DECIMAL(12,2);
  due_amount DECIMAL(12,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM public.payments WHERE due_id = NEW.due_id;
  SELECT amount INTO due_amount FROM public.dues WHERE id = NEW.due_id;
  
  UPDATE public.dues SET
    paid_amount = total_paid,
    status = CASE
      WHEN total_paid >= due_amount THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.due_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_due_on_payment();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dues_updated_at BEFORE UPDATE ON public.dues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();