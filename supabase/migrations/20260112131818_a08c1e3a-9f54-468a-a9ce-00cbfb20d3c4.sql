-- Allow customers to view seller profiles (for displaying shop names)
CREATE POLICY "Customers can view seller profiles for their dues"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.dues d
    JOIN public.customers c ON c.id = d.customer_id
    WHERE d.seller_id = profiles.id
    AND c.mobile = get_user_mobile(auth.uid())
  )
);