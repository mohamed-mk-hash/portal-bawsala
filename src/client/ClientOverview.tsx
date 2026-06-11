import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  Bell,
  BriefcaseBusiness,
  Clock,
  ReceiptText,
  UserCircle,
} from 'lucide-react';
import { Card } from '../components/Card';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { db } from '../firebase';

type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'completed'
  | 'paused';

type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

type ClientService = {
  id: string;
  clientId: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  planNameAr?: string;
  planNameEn?: string;
  status?: ServiceStatus;
  progress?: number;
  teamNote?: string;
  completionApprovalStatus?: 'none' | 'pending' | 'approved' | 'refused';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type ClientInvoice = {
  id: string;
  clientId: string;
  invoiceNumber: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  total?: number;
  currency?: string;
  status?: InvoiceStatus;
  dueDate?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type ClientNotification = {
  id: string;
  clientId: string;
  titleAr?: string;
  titleEn?: string;
  messageAr?: string;
  messageEn?: string;
  isRead?: boolean;
  createdAt?: Timestamp;
};

export const ClientOverview: React.FC = () => {
  const { user, profile } = useAuth();
  const { isArabic } = useLanguage();

  const [services, setServices] = useState<ClientService[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const servicesQuery = query(
      collection(db, 'services'),
      where('clientId', '==', user.uid)
    );

    const invoicesQuery = query(
      collection(db, 'invoices'),
      where('clientId', '==', user.uid)
    );

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('clientId', '==', user.uid)
    );

    const unsubscribeServices = onSnapshot(
      servicesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ClientService[];

        setServices(data);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل بيانات الخدمات.'
            : 'Could not load services data.'
        );
      }
    );

    const unsubscribeInvoices = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ClientInvoice[];

        setInvoices(data);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل بيانات الفواتير.'
            : 'Could not load invoices data.'
        );
      }
    );

    const unsubscribeNotifications = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ClientNotification[];

        setNotifications(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(
          isArabic
            ? 'تعذر تحميل آخر التحديثات.'
            : 'Could not load latest updates.'
        );
        setLoading(false);
      }
    );

    return () => {
      unsubscribeServices();
      unsubscribeInvoices();
      unsubscribeNotifications();
    };
  }, [user, isArabic]);

  const latestUpdates = useMemo(() => {
    const serviceUpdates = services.map((service) => ({
      id: `service-${service.id}`,
      type: 'service',
      title: isArabic
        ? service.serviceNameAr || 'خدمة'
        : service.serviceNameEn || 'Service',
      description: getServiceDescription(service, isArabic),
      date: service.updatedAt || service.createdAt,
    }));

    const invoiceUpdates = invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      type: 'invoice',
      title: invoice.invoiceNumber,
      description: getInvoiceDescription(invoice, isArabic),
      date: invoice.updatedAt || invoice.createdAt,
    }));

    const notificationUpdates = notifications.map((notification) => ({
      id: `notification-${notification.id}`,
      type: 'notification',
      title: isArabic
        ? notification.titleAr || 'إشعار'
        : notification.titleEn || 'Notification',
      description: isArabic
        ? notification.messageAr || ''
        : notification.messageEn || '',
      date: notification.createdAt,
    }));

    return [...serviceUpdates, ...invoiceUpdates, ...notificationUpdates]
      .sort((a, b) => {
        const aTime = a.date?.toMillis?.() || 0;
        const bTime = b.date?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [services, invoices, notifications, isArabic]);

  const servicesCount = services.length;

  const inProgressCount = services.filter(
    (service) => service.status === 'in_progress'
  ).length;

  const invoicesCount = invoices.length;

  const unpaidInvoicesTotal = invoices
    .filter(
      (invoice) =>
        invoice.status === 'pending' ||
        invoice.status === 'overdue' ||
        invoice.status === 'draft'
    )
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  const paidInvoicesTotal = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  const unreadNotifications = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <UserCircle className="h-4 w-4" />
          {isArabic ? 'بوابة العميل' : 'Client Portal'}
        </div>

        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'لوحة العميل' : 'Client Dashboard'}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'نظرة عامة على خدماتك، فواتيرك، وآخر التحديثات.'
            : 'Overview of your services, invoices, and latest updates.'}
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
            <OverviewStatCard
              label={isArabic ? 'الخدمات' : 'Services'}
              value={servicesCount}
              icon={<BriefcaseBusiness className="h-7 w-7" />}
              tone="blue"
            />

            <OverviewStatCard
              label={isArabic ? 'قيد الإنجاز' : 'In Progress'}
              value={inProgressCount}
              icon={<Clock className="h-7 w-7" />}
              tone="yellow"
            />

            <OverviewStatCard
              label={isArabic ? 'الفواتير' : 'Invoices'}
              value={invoicesCount}
              icon={<ReceiptText className="h-7 w-7" />}
              tone="green"
            />

            <OverviewStatCard
              label={isArabic ? 'إشعارات غير مقروءة' : 'Unread Alerts'}
              value={unreadNotifications}
              icon={<Bell className="h-7 w-7" />}
              tone="purple"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="mb-6 text-xl font-black text-gray-950">
                {isArabic ? 'معلومات الحساب' : 'Account Information'}
              </h2>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Detail
                  label={isArabic ? 'الشركة' : 'Company'}
                  value={profile?.companyName || '-'}
                />
                <Detail
                  label={isArabic ? 'الاسم الكامل' : 'Full Name'}
                  value={profile?.fullName || '-'}
                />
                <Detail
                  label={isArabic ? 'البريد الإلكتروني' : 'Email'}
                  value={profile?.email || '-'}
                />
                <Detail
                  label={isArabic ? 'الهاتف' : 'Phone'}
                  value={profile?.phone || '-'}
                />
                <Detail
                  label={isArabic ? 'الحالة' : 'Status'}
                  value={
                    profile?.status === 'active'
                      ? isArabic
                        ? 'نشط'
                        : 'Active'
                      : profile?.status || '-'
                  }
                  highlight
                />
              </div>
            </Card>

            <Card>
              <h2 className="mb-6 text-xl font-black text-gray-950">
                {isArabic ? 'ملخص الفواتير' : 'Invoices Summary'}
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <MoneyBox
                  label={isArabic ? 'إجمالي مدفوع' : 'Paid Total'}
                  value={`${paidInvoicesTotal.toLocaleString()} DZD`}
                  tone="green"
                />

                <MoneyBox
                  label={isArabic ? 'إجمالي غير مدفوع' : 'Unpaid Total'}
                  value={`${unpaidInvoicesTotal.toLocaleString()} DZD`}
                  tone="yellow"
                />
              </div>
            </Card>
          </div>

          <Card>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-950">
                {isArabic ? 'آخر التحديثات' : 'Latest Updates'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isArabic
                  ? 'آخر ما حدث في خدماتك وفواتيرك وإشعاراتك.'
                  : 'Recent activity from your services, invoices, and notifications.'}
              </p>
            </div>

            {latestUpdates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-500">
                {isArabic
                  ? 'لا توجد تحديثات حالياً.'
                  : 'No updates yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {latestUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4"
                  >
                    <div className="rounded-2xl bg-white p-3 text-blue-600 shadow-sm">
                      {update.type === 'service' && (
                        <BriefcaseBusiness className="h-5 w-5" />
                      )}
                      {update.type === 'invoice' && (
                        <ReceiptText className="h-5 w-5" />
                      )}
                      {update.type === 'notification' && (
                        <Bell className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <p className="font-black text-gray-950">
                          {update.title}
                        </p>

                        <p className="text-xs font-bold text-gray-400">
                          {formatDate(update.date, isArabic)}
                        </p>
                      </div>

                      <p className="mt-1 text-sm leading-7 text-gray-500">
                        {update.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

function OverviewStatCard({
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

function Detail({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-sm font-bold text-gray-500">{label}</p>
      <p
        className={`mt-2 font-black ${
          highlight ? 'text-green-600' : 'text-gray-950'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MoneyBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'green' | 'yellow';
}) {
  const styles = {
    green: 'border-green-200 bg-green-50 text-green-700',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  };

  return (
    <div className={`rounded-3xl border p-5 ${styles[tone]}`}>
      <p className="text-sm font-bold opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function getServiceDescription(service: ClientService, isArabic: boolean) {
  const status = service.status || 'not_started';
  const progress = Number(service.progress || 0);

  const labels: Record<ServiceStatus, { ar: string; en: string }> = {
    not_started: { ar: 'لم تبدأ بعد', en: 'Not started yet' },
    in_progress: { ar: 'قيد العمل', en: 'In progress' },
    waiting_client: { ar: 'بانتظار العميل', en: 'Waiting for client' },
    completed: { ar: 'مكتملة', en: 'Completed' },
    paused: { ar: 'متوقفة مؤقتاً', en: 'Paused' },
  };

  return isArabic
    ? `حالة الخدمة: ${labels[status].ar}. نسبة التقدم: ${progress}%.`
    : `Service status: ${labels[status].en}. Progress: ${progress}%.`;
}

function getInvoiceDescription(invoice: ClientInvoice, isArabic: boolean) {
  const status = invoice.status || 'draft';
  const total = Number(invoice.total || 0).toLocaleString();
  const currency = invoice.currency || 'DZD';

  const labels: Record<InvoiceStatus, { ar: string; en: string }> = {
    draft: { ar: 'مسودة', en: 'Draft' },
    pending: { ar: 'بانتظار الدفع', en: 'Pending' },
    paid: { ar: 'مدفوعة', en: 'Paid' },
    overdue: { ar: 'متأخرة', en: 'Overdue' },
    cancelled: { ar: 'ملغاة', en: 'Cancelled' },
  };

  return isArabic
    ? `حالة الفاتورة: ${labels[status].ar}. المبلغ: ${total} ${currency}.`
    : `Invoice status: ${labels[status].en}. Amount: ${total} ${currency}.`;
}

function formatDate(date: Timestamp | undefined, isArabic: boolean) {
  if (!date) return '-';

  return date.toDate().toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}