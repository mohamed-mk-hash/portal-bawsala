export interface Order {
  id: string;
  customer: string;
  product: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  date: string;
}

export interface RevenueData {
  month: string;
  revenue: number;
  orders: number;
}

export interface Stats {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
}
