import type { Order, RevenueData, Stats } from '../types';

export const getStats = (t: any): Stats[] => [
  {
    label: t.totalRevenue,
    value: '$45,231',
    change: '+20.1%',
    trend: 'up',
  },
  {
    label: t.orders,
    value: '2,350',
    change: '+15.3%',
    trend: 'up',
  },
  {
    label: t.customers,
    value: '1,842',
    change: '+12.5%',
    trend: 'up',
  },
  {
    label: t.avgOrder,
    value: '$19.25',
    change: '-4.3%',
    trend: 'down',
  },
];

export const revenueData: RevenueData[] = [
  { month: 'Jan', revenue: 4200, orders: 320 },
  { month: 'Feb', revenue: 3800, orders: 295 },
  { month: 'Mar', revenue: 5100, orders: 385 },
  { month: 'Apr', revenue: 4600, orders: 342 },
  { month: 'May', revenue: 5800, orders: 425 },
  { month: 'Jun', revenue: 6200, orders: 468 },
];

export const recentOrders: Order[] = [
  {
    id: 'ORD-001',
    customer: 'John Doe',
    product: 'Premium Plan',
    amount: 99.99,
    status: 'completed',
    date: '2025-11-24',
  },
  {
    id: 'ORD-002',
    customer: 'Jane Smith',
    product: 'Basic Plan',
    amount: 29.99,
    status: 'processing',
    date: '2025-11-24',
  },
  {
    id: 'ORD-003',
    customer: 'Bob Johnson',
    product: 'Enterprise Plan',
    amount: 299.99,
    status: 'pending',
    date: '2025-11-23',
  },
  {
    id: 'ORD-004',
    customer: 'Alice Brown',
    product: 'Premium Plan',
    amount: 99.99,
    status: 'completed',
    date: '2025-11-23',
  },
  {
    id: 'ORD-005',
    customer: 'Charlie Davis',
    product: 'Basic Plan',
    amount: 29.99,
    status: 'cancelled',
    date: '2025-11-22',
  },
];