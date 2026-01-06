export type AppRole = 'seller' | 'customer';

export interface Profile {
  id: string;
  mobile: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Customer {
  id: string;
  seller_id: string;
  mobile: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Due {
  id: string;
  customer_id: string;
  seller_id: string;
  description: string;
  amount: number;
  paid_amount: number;
  status: 'pending' | 'partial' | 'paid';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  due_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
}

export interface CustomerWithDues extends Customer {
  total_due: number;
  total_paid: number;
  dues?: Due[];
}

export interface DueWithCustomer extends Due {
  customer?: Customer;
}

export interface SellerInfo {
  id: string;
  name: string;
  total_due: number;
  total_paid: number;
}
