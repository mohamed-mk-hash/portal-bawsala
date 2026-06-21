import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { AlertTriangle, BarChart3, BriefcaseBusiness, CheckCircle2, CreditCard, Flame, Users } from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import type { ActivityRecord, ClientRecord, DealRecord, InvoiceRecord } from '../types/adminDashboard.ts';
import { useAuth } from '../auth/AuthContext';

const formatMoney = (amount: number, currency = 'DZD') => {
  return `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: currency === 'DZD' ? 0 : 2,
    maximumFractionDigits: currency === 'DZD' ? 0 : 2,
  })} ${currency}`;
};

const isPast = (date?: string) => {
  if (!date) return false;
  const today = new Date();
  const todayIso = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return date < todayIso;
};

const groupCount = <T,>(items: T[], getKey: (item: T) => string | undefined) => {
  return items.reduce<Record<string, number>>((result, item) => {
    const key = getKey(item) || 'غير محدد';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
};

const groupSumByCurrency = <T,>(items: T[], getAmount: (item: T) => number, getCurrency: (item: T) => string | undefined) => {
  return items.reduce<Record<string, number>>((result, item) => {
    const currency = getCurrency(item) || 'DZD';
    result[currency] = (result[currency] || 0) + Number(getAmount(item) || 0);
    return result;
  }, {});
};

const moneyGroupLabel = (totals: Record<string, number>) => {
  const entries = Object.entries(totals);
  if (entries.length === 0) return formatMoney(0, 'DZD');
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' / ');
};

export const AdminOverview: React.FC = () => {
  const { isArabic } = useLanguage();
  const { profile, role, user } = useAuth();
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(query(collection(db, 'deals')), (snapshot) => {
        setDeals(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as DealRecord[]);
      }),
      onSnapshot(query(collection(db, 'clients')), (snapshot) => {
        setClients(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ClientRecord[]);
      }),
      onSnapshot(query(collection(db, 'invoices')), (snapshot) => {
        setInvoices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as InvoiceRecord[]);
      }),
      onSnapshot(query(collection(db, 'activities')), (snapshot) => {
        setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ActivityRecord[]);
        setLoading(false);
      }, () => setLoading(false)),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const visibleDeals = useMemo(() => {
  return deals.filter((deal) => {
    if (role === 'admin' || role === 'super_admin') return true;

    if (
      role === 'department_head' &&
      profile?.department === deal.department
    ) {
      return true;
    }

    if (
      role === 'owner' &&
      (
        deal.ownerUid === user?.uid ||
        deal.ownerEmail === user?.email ||
        deal.owner === profile?.ownerName ||
        deal.owner === profile?.fullName
      )
    ) {
      return true;
    }

    return false;
  });
}, [deals, role, profile, user]);

  const metrics = useMemo(() => {
    const openDeals = visibleDeals.filter((deal) => deal.dealStatus === 'Open');
    const wonDeals = visibleDeals.filter((deal) => deal.dealStatus === 'Won');
    const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid');
    const pendingInvoices = invoices.filter((invoice) => invoice.status === 'pending');
    const overdueInvoices = invoices.filter((invoice) => invoice.status === 'overdue' || (invoice.status !== 'paid' && invoice.status !== 'cancelled' && isPast(invoice.dueDate)));
    const doneActivities = activities.filter((activity) => activity.status === 'Done');
    const lateActivities = activities.filter((activity) => activity.status !== 'Done' && isPast(activity.dueDate));

    return {
      pipelineValue: moneyGroupLabel(groupSumByCurrency(openDeals, (deal) => Number(deal.dealValue || 0), (deal) => deal.currency)),
      wonValue: moneyGroupLabel(groupSumByCurrency(wonDeals, (deal) => Number(deal.dealValue || 0), (deal) => deal.currency)),
      paidRevenue: moneyGroupLabel(groupSumByCurrency(paidInvoices, (invoice) => Number(invoice.total || 0), (invoice) => invoice.currency)),
      openDealsCount: openDeals.length,
      wonDealsCount: wonDeals.length,
      pendingInvoicesCount: pendingInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      doneActivitiesCount: doneActivities.length,
      lateActivitiesCount: lateActivities.length,
      clientsCount: clients.length,
    };
  }, [visibleDeals, invoices, activities, clients]);

  const departmentPerformance = useMemo(() => {
    const departments = Array.from(new Set([
      ...visibleDeals.map((deal) => deal.department).filter(Boolean),
      ...activities.map((activity) => activity.department).filter(Boolean),
    ])) as string[];

    return departments.map((department) => {
      const departmentActivities = activities.filter((activity) => activity.department === department);
      const done = departmentActivities.filter((activity) => activity.status === 'Done').length;
      const late = departmentActivities.filter((activity) => activity.status !== 'Done' && isPast(activity.dueDate)).length;
      const openDeals = visibleDeals.filter((deal) => deal.department === department && deal.dealStatus === 'Open').length;

      return { department, done, late, openDeals, total: departmentActivities.length };
    }).sort((a, b) => b.total - a.total);
  }, [visibleDeals, activities]);

  const clientsByTemperature = useMemo(() => groupCount(clients, (client) => client.customerTemperature), [clients]);
  const clientsByCountry = useMemo(() => Object.entries(groupCount(clients, (client) => client.country)).slice(0, 8), [clients]);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <BarChart3 className="h-4 w-4" />
          {isArabic ? 'لوحة القيادة التنفيذية' : 'Executive Dashboard'}
        </div>
        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'نظرة عامة على المبيعات والعمليات' : 'Sales and Operations Overview'}
        </h1>
        <p className="mt-2 text-gray-500">
          {isArabic ? 'هذه الصفحة تجمع الصفقات، الفواتير، العملاء، والمهام في مكان واحد للإدارة العليا.' : 'This page combines deals, invoices, clients, and activities in one executive view.'}
        </p>
      </div>

      {loading && <p className="rounded-2xl bg-blue-50 p-4 font-bold text-blue-700">{isArabic ? 'جاري تحميل المؤشرات...' : 'Loading metrics...'}</p>}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<BriefcaseBusiness />} label={isArabic ? 'قيمة الصفقات المفتوحة' : 'Open Pipeline Value'} value={metrics.pipelineValue} />
        <MetricCard icon={<CheckCircle2 />} label={isArabic ? 'قيمة الصفقات الرابحة' : 'Won Deal Value'} value={metrics.wonValue} />
        <MetricCard icon={<CreditCard />} label={isArabic ? 'إيرادات الفواتير المدفوعة' : 'Paid Invoice Revenue'} value={metrics.paidRevenue} />
        <MetricCard icon={<Users />} label={isArabic ? 'إجمالي العملاء' : 'Total Clients'} value={metrics.clientsCount.toString()} />
        <MetricCard icon={<BriefcaseBusiness />} label={isArabic ? 'صفقات مفتوحة' : 'Open Deals'} value={metrics.openDealsCount.toString()} />
        <MetricCard icon={<CheckCircle2 />} label={isArabic ? 'صفقات ناجحة' : 'Won Deals'} value={metrics.wonDealsCount.toString()} />
        <MetricCard icon={<CreditCard />} label={isArabic ? 'فواتير بانتظار الدفع' : 'Pending Invoices'} value={metrics.pendingInvoicesCount.toString()} />
        <MetricCard icon={<AlertTriangle />} label={isArabic ? 'فواتير/مهام متأخرة' : 'Late Items'} value={`${metrics.overdueInvoicesCount} / ${metrics.lateActivitiesCount}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-gray-950">{isArabic ? 'أداء الأقسام' : 'Department Performance'}</h2>
          <p className="mt-1 text-sm text-gray-500">{isArabic ? 'قياس المهام المنجزة والمتأخرة والصفقات المفتوحة لكل قسم.' : 'Done tasks, late tasks, and open deals per department.'}</p>
          <div className="mt-6 space-y-4">
            {departmentPerformance.length === 0 && <EmptyText text={isArabic ? 'لا توجد بيانات أقسام بعد.' : 'No department data yet.'} />}
            {departmentPerformance.map((item) => (
              <div key={item.department} className="rounded-3xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-gray-900">{item.department}</p>
                  <p className="text-xs font-bold text-gray-500">{isArabic ? 'صفقات مفتوحة' : 'Open deals'}: {item.openDeals}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Badge label={isArabic ? 'منجزة' : 'Done'} value={item.done} tone="green" />
                  <Badge label={isArabic ? 'متأخرة' : 'Late'} value={item.late} tone="red" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-gray-950">{isArabic ? 'تحليل العملاء' : 'Client Analysis'}</h2>
          <p className="mt-1 text-sm text-gray-500">{isArabic ? 'توزيع العملاء حسب الحرارة والدولة.' : 'Client distribution by temperature and country.'}</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <TemperatureCard icon={<Flame className="h-5 w-5" />} label={isArabic ? 'ساخن' : 'Hot'} value={clientsByTemperature.Hot || 0} />
            <TemperatureCard icon={<Flame className="h-5 w-5" />} label={isArabic ? 'دافئ' : 'Warm'} value={clientsByTemperature.Warm || 0} />
            <TemperatureCard icon={<Flame className="h-5 w-5" />} label={isArabic ? 'بارد' : 'Cold'} value={clientsByTemperature.Cold || 0} />
          </div>

          <div className="mt-6 space-y-3">
            {clientsByCountry.length === 0 && <EmptyText text={isArabic ? 'لا توجد بيانات دول بعد.' : 'No country data yet.'} />}
            {clientsByCountry.map(([country, count]) => (
              <div key={country} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm font-bold text-gray-600">{country}</div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(8, Math.min(100, (count / Math.max(1, clients.length)) * 100))}%` }} />
                </div>
                <div className="w-10 text-end text-sm font-black text-gray-900">{count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-gray-950">{isArabic ? 'آخر المهام المتأخرة' : 'Latest Late Activities'}</h2>
        <div className="mt-5 overflow-hidden rounded-3xl border border-gray-100">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-5 py-4 text-start">{isArabic ? 'المهمة' : 'Activity'}</th>
                <th className="px-5 py-4 text-start">{isArabic ? 'الصفقة' : 'Deal'}</th>
                <th className="px-5 py-4 text-start">{isArabic ? 'القسم' : 'Department'}</th>
                <th className="px-5 py-4 text-start">{isArabic ? 'المسؤول' : 'Owner'}</th>
                <th className="px-5 py-4 text-start">{isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
  {activities.filter((activity) => activity.status !== 'Done' && isPast(activity.dueDate)).length === 0 ? (
    <tr>
      <td
        colSpan={5}
        className="px-5 py-10 text-center text-lg font-black text-gray-500"
      >
        {isArabic ? 'لا توجد أي خدمات حالياً' : 'No services currently'}
      </td>
    </tr>
  ) : (
    activities
      .filter((activity) => activity.status !== 'Done' && isPast(activity.dueDate))
      .slice(0, 8)
      .map((activity) => (
        <tr key={activity.id} className="bg-red-50/40">
          <td className="px-5 py-4 font-bold text-gray-950">
            {activity.subject || '-'}
          </td>
          <td className="px-5 py-4 text-gray-600">
            {activity.dealTitle || '-'}
          </td>
          <td className="px-5 py-4 text-gray-600">
            {activity.department || '-'}
          </td>
          <td className="px-5 py-4 text-gray-600">
            {activity.owner || '-'}
          </td>
          <td className="px-5 py-4 font-black text-red-700">
            {activity.dueDate || '-'}
          </td>
        </tr>
      ))
  )}
</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

type IconElement = React.ReactElement<{ className?: string }>;

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: IconElement;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-gray-500">{label}</p>

        <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
          {React.cloneElement(icon, { className: 'h-5 w-5' })}
        </div>
      </div>

      <p className="mt-5 break-words text-2xl font-black text-gray-950">
        {value}
      </p>
    </div>
  );
}

function Badge({ label, value, tone }: { label: string; value: number; tone: 'green' | 'red' }) {
  const cls = tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  return <div className={`rounded-2xl px-4 py-3 font-black ${cls}`}>{label}: {value}</div>;
}

function TemperatureCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-gray-500">{icon}<span className="text-sm font-bold">{label}</span></div>
      <p className="mt-3 text-3xl font-black text-gray-950">{value}</p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center font-bold text-gray-500">{text}</p>;
}
