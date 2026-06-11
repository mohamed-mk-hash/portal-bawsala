import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BriefcaseBusiness,
  CheckCircle,
  FileText,
  ReceiptText,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

type AccessRequestStatus = 'pending' | 'accepted' | 'refused';
type ServiceRequestStatus = 'pending' | 'accepted' | 'refused';
type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'completed'
  | 'paused';
type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

type AccessRequest = {
  id: string;
  companyName?: string;
  fullName?: string;
  email?: string;
  status?: AccessRequestStatus;
  createdAt?: Timestamp;
};

type ServiceRequest = {
  id: string;
  companyName?: string;
  clientName?: string;
  clientEmail?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  planNameAr?: string;
  planNameEn?: string;
  status?: ServiceRequestStatus;
  createdAt?: Timestamp;
};

type Service = {
  id: string;
  companyName?: string;
  clientName?: string;
  clientEmail?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  planNameAr?: string;
  planNameEn?: string;
  status?: ServiceStatus;
  progress?: number;
  completionApprovalStatus?: 'none' | 'pending' | 'approved' | 'refused';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type Invoice = {
  id: string;
  invoiceNumber?: string;
  companyName?: string;
  clientName?: string;
  clientEmail?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  total?: number;
  currency?: string;
  status?: InvoiceStatus;
  issueDate?: string;
  dueDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type UserProfile = {
  id: string;
  role?: 'admin' | 'client';
  status?: 'active' | 'disabled';
  companyName?: string;
  fullName?: string;
  email?: string;
  createdAt?: Timestamp;
};

type ActivityItem = {
  id: string;
  type: 'account' | 'serviceRequest' | 'service' | 'invoice';
  title: string;
  subtitle: string;
  status: string;
  date?: Timestamp;
};

export const Overview: React.FC = () => {
  const { t, isArabic } = useLanguage();

  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    const unsubAccessRequests = onSnapshot(
      collection(db, 'accessRequests'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AccessRequest[];

        setAccessRequests(data);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل طلبات الحسابات.'
            : 'Could not load account requests.'
        );
      }
    );

    const unsubServiceRequests = onSnapshot(
      collection(db, 'serviceRequests'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ServiceRequest[];

        setServiceRequests(data);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل طلبات الخدمة.'
            : 'Could not load service requests.'
        );
      }
    );

    const unsubServices = onSnapshot(
      collection(db, 'services'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Service[];

        setServices(data);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل الخدمات الحالية.'
            : 'Could not load current services.'
        );
      }
    );

    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Invoice[];

        setInvoices(data);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل الفواتير.'
            : 'Could not load invoices.'
        );
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as UserProfile[];

        setUsers(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل المستخدمين.'
            : 'Could not load users.'
        );
        setLoading(false);
      }
    );

    return () => {
      unsubAccessRequests();
      unsubServiceRequests();
      unsubServices();
      unsubInvoices();
      unsubUsers();
    };
  }, [isArabic]);

  const clients = users.filter((user) => user.role === 'client');

  const pendingAccountRequests = accessRequests.filter(
    (request) => request.status === 'pending'
  ).length;

  const pendingServiceRequests = serviceRequests.filter(
    (request) => request.status === 'pending'
  ).length;

  const activeServices = services.filter(
    (service) =>
      service.status === 'in_progress' ||
      service.status === 'waiting_client' ||
      service.status === 'not_started'
  ).length;

  const completedServices = services.filter(
    (service) => service.status === 'completed'
  ).length;

  const paidRevenue = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  const pendingRevenue = invoices
    .filter(
      (invoice) =>
        invoice.status === 'pending' ||
        invoice.status === 'overdue' ||
        invoice.status === 'draft'
    )
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  const revenueData = useMemo(() => {
    return buildRevenueData(invoices, isArabic);
  }, [invoices, isArabic]);

  const latestActivities = useMemo(() => {
    const accountActivities: ActivityItem[] = accessRequests.map((request) => ({
      id: `account-${request.id}`,
      type: 'account',
      title: isArabic ? 'طلب حساب جديد' : 'New account request',
      subtitle:
        request.companyName ||
        request.fullName ||
        request.email ||
        (isArabic ? 'بدون اسم' : 'Unnamed'),
      status: request.status || 'pending',
      date: request.createdAt,
    }));

    const serviceRequestActivities: ActivityItem[] = serviceRequests.map(
      (request) => ({
        id: `service-request-${request.id}`,
        type: 'serviceRequest',
        title: isArabic ? 'طلب خدمة جديد' : 'New service request',
        subtitle: `${request.companyName || '-'} — ${
          isArabic
            ? request.serviceNameAr || '-'
            : request.serviceNameEn || '-'
        }`,
        status: request.status || 'pending',
        date: request.createdAt,
      })
    );

    const serviceActivities: ActivityItem[] = services.map((service) => ({
      id: `service-${service.id}`,
      type: 'service',
      title: isArabic ? 'خدمة حالية' : 'Current service',
      subtitle: `${service.companyName || '-'} — ${
        isArabic
          ? service.serviceNameAr || '-'
          : service.serviceNameEn || '-'
      }`,
      status: service.status || 'not_started',
      date: service.updatedAt || service.createdAt,
    }));

    const invoiceActivities: ActivityItem[] = invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      type: 'invoice',
      title: invoice.invoiceNumber || (isArabic ? 'فاتورة' : 'Invoice'),
      subtitle: `${invoice.companyName || '-'} — ${Number(
        invoice.total || 0
      ).toLocaleString()} ${invoice.currency || 'DZD'}`,
      status: invoice.status || 'draft',
      date: invoice.updatedAt || invoice.createdAt,
    }));

    return [
      ...accountActivities,
      ...serviceRequestActivities,
      ...serviceActivities,
      ...invoiceActivities,
    ]
      .sort((a, b) => {
        const aTime = a.date?.toMillis?.() || 0;
        const bTime = b.date?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 8);
  }, [accessRequests, serviceRequests, services, invoices, isArabic]);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <h1 className="text-3xl font-black text-gray-950">
          {t.overview || (isArabic ? 'نظرة عامة' : 'Overview')}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'بيانات مباشرة من Firestore حول العملاء، الطلبات، الخدمات، والفواتير.'
            : 'Live Firestore data about clients, requests, services, and invoices.'}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          {isArabic ? 'جاري تحميل البيانات...' : 'Loading dashboard data...'}
        </div>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label={isArabic ? 'العملاء' : 'Clients'}
              value={clients.length}
              icon={<Users className="h-7 w-7" />}
              tone="blue"
            />

            <AdminStatCard
              label={isArabic ? 'طلبات الحسابات' : 'Account Requests'}
              value={pendingAccountRequests}
              icon={<UserPlus className="h-7 w-7" />}
              tone="yellow"
            />

            <AdminStatCard
              label={isArabic ? 'طلبات الخدمة' : 'Service Requests'}
              value={pendingServiceRequests}
              icon={<FileText className="h-7 w-7" />}
              tone="purple"
            />

            <AdminStatCard
              label={isArabic ? 'الخدمات النشطة' : 'Active Services'}
              value={activeServices}
              icon={<BriefcaseBusiness className="h-7 w-7" />}
              tone="green"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <MoneyStatCard
              label={isArabic ? 'الإيرادات المدفوعة' : 'Paid Revenue'}
              value={`${paidRevenue.toLocaleString()} DZD`}
              icon={<Wallet className="h-7 w-7" />}
              tone="green"
            />

            <MoneyStatCard
              label={isArabic ? 'إيرادات بانتظار الدفع' : 'Pending Revenue'}
              value={`${pendingRevenue.toLocaleString()} DZD`}
              icon={<ReceiptText className="h-7 w-7" />}
              tone="yellow"
            />

            <MoneyStatCard
              label={isArabic ? 'الخدمات المكتملة' : 'Completed Services'}
              value={completedServices}
              icon={<CheckCircle className="h-7 w-7" />}
              tone="blue"
            />
          </div>

          <Card>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-950">
                {isArabic ? 'نظرة على الإيرادات' : 'Revenue Overview'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isArabic
                  ? 'الإيرادات المدفوعة حسب الشهر من الفواتير.'
                  : 'Paid invoice revenue by month.'}
              </p>
            </div>

            {revenueData.every((item) => item.revenue === 0) ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500">
                {isArabic
                  ? 'لا توجد إيرادات مدفوعة بعد.'
                  : 'No paid revenue yet.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} DZD`,
                      isArabic ? 'الإيرادات' : 'Revenue',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-950">
                {isArabic ? 'آخر النشاطات' : 'Latest Activity'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isArabic
                  ? 'آخر الطلبات والخدمات والفواتير حسب التحديثات الأخيرة.'
                  : 'Latest requests, services, and invoices based on recent updates.'}
              </p>
            </div>

            {latestActivities.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500">
                {isArabic ? 'لا توجد نشاطات حالياً.' : 'No activity yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th
                        className={`px-4 py-3 text-sm font-black text-gray-500 ${
                          isArabic ? 'text-right' : 'text-left'
                        }`}
                      >
                        {isArabic ? 'النوع' : 'Type'}
                      </th>
                      <th
                        className={`px-4 py-3 text-sm font-black text-gray-500 ${
                          isArabic ? 'text-right' : 'text-left'
                        }`}
                      >
                        {isArabic ? 'العنوان' : 'Title'}
                      </th>
                      <th
                        className={`px-4 py-3 text-sm font-black text-gray-500 ${
                          isArabic ? 'text-right' : 'text-left'
                        }`}
                      >
                        {isArabic ? 'التفاصيل' : 'Details'}
                      </th>
                      <th
                        className={`px-4 py-3 text-sm font-black text-gray-500 ${
                          isArabic ? 'text-right' : 'text-left'
                        }`}
                      >
                        {isArabic ? 'الحالة' : 'Status'}
                      </th>
                      <th
                        className={`px-4 py-3 text-sm font-black text-gray-500 ${
                          isArabic ? 'text-right' : 'text-left'
                        }`}
                      >
                        {isArabic ? 'التاريخ' : 'Date'}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {latestActivities.map((activity) => (
                      <tr
                        key={activity.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-4 py-4">
                          <ActivityTypeBadge
                            type={activity.type}
                            isArabic={isArabic}
                          />
                        </td>

                        <td className="px-4 py-4 text-sm font-black text-gray-950">
                          {activity.title}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-500">
                          {activity.subtitle}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={activity.status}
                            isArabic={isArabic}
                          />
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDate(activity.date, isArabic)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

function AdminStatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: 'blue' | 'yellow' | 'green' | 'purple';
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-3 text-4xl font-black text-gray-950">{value}</p>
        </div>

        <div className={`rounded-2xl p-4 ${styles[tone]}`}>{icon}</div>
      </div>
    </div>
  );
}

function MoneyStatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: 'blue' | 'yellow' | 'green';
}) {
  const styles = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    yellow: 'border-yellow-100 bg-yellow-50 text-yellow-700',
    green: 'border-green-100 bg-green-50 text-green-700',
  };

  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${styles[tone]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold opacity-80">{label}</p>
          <p className="mt-3 text-3xl font-black">{value}</p>
        </div>

        <div className="rounded-2xl bg-white/70 p-4">{icon}</div>
      </div>
    </div>
  );
}

function ActivityTypeBadge({
  type,
  isArabic,
}: {
  type: ActivityItem['type'];
  isArabic: boolean;
}) {
  const labels = {
    account: isArabic ? 'طلب حساب' : 'Account',
    serviceRequest: isArabic ? 'طلب خدمة' : 'Service Request',
    service: isArabic ? 'خدمة' : 'Service',
    invoice: isArabic ? 'فاتورة' : 'Invoice',
  };

  const styles = {
    account: 'bg-purple-50 text-purple-700',
    serviceRequest: 'bg-blue-50 text-blue-700',
    service: 'bg-green-50 text-green-700',
    invoice: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function StatusBadge({
  status,
  isArabic,
}: {
  status: string;
  isArabic: boolean;
}) {
  const normalized = status || 'pending';

  const labels: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'قيد المراجعة', en: 'Pending' },
    accepted: { ar: 'مقبول', en: 'Accepted' },
    refused: { ar: 'مرفوض', en: 'Refused' },
    not_started: { ar: 'لم تبدأ', en: 'Not Started' },
    in_progress: { ar: 'قيد العمل', en: 'In Progress' },
    waiting_client: { ar: 'بانتظار العميل', en: 'Waiting Client' },
    completed: { ar: 'مكتملة', en: 'Completed' },
    paused: { ar: 'متوقفة', en: 'Paused' },
    draft: { ar: 'مسودة', en: 'Draft' },
    paid: { ar: 'مدفوعة', en: 'Paid' },
    overdue: { ar: 'متأخرة', en: 'Overdue' },
    cancelled: { ar: 'ملغاة', en: 'Cancelled' },
  };

  const positiveStatuses = ['accepted', 'completed', 'paid'];
  const warningStatuses = [
    'pending',
    'not_started',
    'waiting_client',
    'draft',
    'overdue',
  ];
  const negativeStatuses = ['refused', 'cancelled', 'paused'];

  let className = 'bg-blue-50 text-blue-700';

  if (positiveStatuses.includes(normalized)) {
    className = 'bg-green-50 text-green-700';
  }

  if (warningStatuses.includes(normalized)) {
    className = 'bg-yellow-50 text-yellow-700';
  }

  if (negativeStatuses.includes(normalized)) {
    className = 'bg-red-50 text-red-700';
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {isArabic
        ? labels[normalized]?.ar || normalized
        : labels[normalized]?.en || normalized}
    </span>
  );
}

function buildRevenueData(invoices: Invoice[], isArabic: boolean) {
  const now = new Date();

  const months = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US', {
        month: 'short',
      }),
      revenue: 0,
    };
  });

  invoices
    .filter((invoice) => invoice.status === 'paid')
    .forEach((invoice) => {
      const invoiceDate =
        invoice.createdAt?.toDate?.() ||
        (invoice.issueDate ? new Date(invoice.issueDate) : null);

      if (!invoiceDate || Number.isNaN(invoiceDate.getTime())) return;

      const key = `${invoiceDate.getFullYear()}-${invoiceDate.getMonth()}`;
      const month = months.find((item) => item.key === key);

      if (month) {
        month.revenue += Number(invoice.total || 0);
      }
    });

  return months;
}

function formatDate(date: Timestamp | undefined, isArabic: boolean) {
  if (!date) return '-';

  return date.toDate().toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}