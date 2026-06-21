import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { BriefcaseBusiness, Eye, Pencil, Search, X } from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import type { ActiveServiceRecord } from '../types/adminDashboard';
import { useAuth } from '../auth/AuthContext';

type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'delivered'
  | 'completed'
  | 'paused';

type EditForm = {
  status: ServiceStatus;
  progress: number;
  adminNote: string;
  teamNote: string;
  owner: string;
  department: string;
  startDate: string;
  expectedDeliveryDate: string;
};

const statusOptions: { value: ServiceStatus; ar: string; en: string }[] = [
  { value: 'not_started', ar: 'لم تبدأ', en: 'Not Started' },
  { value: 'in_progress', ar: 'قيد التنفيذ', en: 'In Progress' },
  { value: 'waiting_client', ar: 'بانتظار العميل', en: 'Waiting Client' },
  { value: 'delivered', ar: 'تم التسليم', en: 'Delivered' },
  { value: 'completed', ar: 'مكتملة', en: 'Completed' },
  { value: 'paused', ar: 'متوقفة مؤقتاً', en: 'Paused' },
];

const departments = [
  'قسم إدارة المواقع',
  'قسم إدارة منصات التواصل الاجتماعي',
  'قسم المناهج والبرامج',
  'قسم إعداد الحقائب التدريبية',
  'قسم التطوير الإداري',
  'منتجات بوصلة',
  'الخدمات الإضافية',
];

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const getStatusLabel = (status: string | undefined, isArabic: boolean) => {
  const item = statusOptions.find((option) => option.value === status);
  if (!item) return status || '-';
  return isArabic ? item.ar : item.en;
};

const statusTone = (status?: string) => {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'delivered') return 'bg-blue-100 text-blue-700';
  if (status === 'in_progress') return 'bg-cyan-100 text-cyan-700';
  if (status === 'waiting_client') return 'bg-amber-100 text-amber-700';
  if (status === 'paused') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
};

const fillForm = (service: ActiveServiceRecord): EditForm => ({
  status: (service.status as ServiceStatus) || 'not_started',
  progress: Number(service.progress || 0),
  adminNote: service.adminNote || '',
  teamNote: service.teamNote || '',
  owner: service.owner || '',
  department: service.department || departments[0],
  startDate: service.startDate || '',
  expectedDeliveryDate: service.expectedDeliveryDate || '',
});

export const ActiveServices: React.FC = () => {
  const { isArabic } = useLanguage();
  const { profile, role, user } = useAuth();

  const [services, setServices] = useState<ActiveServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedService, setSelectedService] =
    useState<ActiveServiceRecord | null>(null);
  const [editingService, setEditingService] =
    useState<ActiveServiceRecord | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'services'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setServices(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as ActiveServiceRecord[]
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
        setError(
          isArabic
            ? 'تعذر تحميل الخدمات الجارية. تحقق من صلاحيات Firestore.'
            : 'Could not load active services. Check Firestore permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [isArabic]);

  const canSeeService = (service: ActiveServiceRecord) => {
    if (role === 'admin' || role === 'super_admin') return true;

    if (role === 'department_head') {
      return Boolean(
        profile?.department &&
          service.department === profile.department
      );
    }

    if (role === 'owner') {
      return Boolean(
        service.ownerUid === user?.uid ||
          service.ownerEmail === user?.email ||
          service.owner === profile?.ownerName ||
          service.owner === profile?.fullName
      );
    }

    return false;
  };

  const visibleServices = useMemo<ActiveServiceRecord[]>(() => {
    return services.filter(canSeeService);
  }, [services, role, profile, user]);

  const filteredServices = useMemo<ActiveServiceRecord[]>(() => {
    const text = search.trim().toLowerCase();

    return visibleServices.filter((service: ActiveServiceRecord) => {
      const matchesText =
        !text ||
        [
          service.clientName,
          service.companyName,
          service.clientEmail,
          service.serviceNameAr,
          service.serviceNameEn,
          service.planNameAr,
          service.planNameEn,
          service.owner,
          service.department,
          service.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text);

      const matchesStatus =
        statusFilter === 'all' || service.status === statusFilter;

      return matchesText && matchesStatus;
    });
  }, [visibleServices, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: visibleServices.length,
      notStarted: visibleServices.filter(
        (service: ActiveServiceRecord) => service.status === 'not_started'
      ).length,
      inProgress: visibleServices.filter(
        (service: ActiveServiceRecord) => service.status === 'in_progress'
      ).length,
      completed: visibleServices.filter(
        (service: ActiveServiceRecord) => service.status === 'completed'
      ).length,
    }),
    [visibleServices]
  );

  const openEdit = (service: ActiveServiceRecord) => {
    setSelectedService(null);
    setEditingService(service);
    setForm(fillForm(service));
    setMessage('');
    setError('');
  };

  const updateForm = <K extends keyof EditForm>(
    key: K,
    value: EditForm[K]
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !form) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');

      if (
        role === 'department_head' &&
        profile?.department &&
        form.department !== profile.department
      ) {
        setError(
          isArabic
            ? 'لا يمكنك نقل الخدمة إلى قسم آخر.'
            : 'You cannot move the service to another department.'
        );
        return;
      }

      if (
        role === 'owner' &&
        form.owner.trim() !==
          (profile?.ownerName || profile?.fullName || '')
      ) {
        setError(
          isArabic
            ? 'لا يمكنك إسناد الخدمة إلى مسؤول آخر.'
            : 'You cannot assign the service to another owner.'
        );
        return;
      }

      const progress = Math.max(0, Math.min(100, Number(form.progress || 0)));

      await updateDoc(doc(db, 'services', editingService.id), {
        status: form.status,
        progress,
        adminNote: form.adminNote.trim(),
        teamNote: form.teamNote.trim(),
        owner: form.owner.trim(),
        ownerUid:
          role === 'owner'
            ? user?.uid || editingService.ownerUid || ''
            : editingService.ownerUid || '',
        ownerEmail:
          role === 'owner'
            ? user?.email || editingService.ownerEmail || ''
            : editingService.ownerEmail || '',
        department: form.department,
        startDate: form.startDate,
        expectedDeliveryDate: form.expectedDeliveryDate,
        updatedAt: serverTimestamp(),
      });

      setMessage(
        isArabic
          ? 'تم تحديث الخدمة الجارية بنجاح.'
          : 'Active service updated successfully.'
      );
      setEditingService(null);
      setForm(null);
    } catch (err) {
      console.error(err);
      setError(
        isArabic
          ? 'حدث خطأ أثناء تحديث الخدمة.'
          : 'Failed to update the service.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <BriefcaseBusiness className="h-4 w-4" />
          {isArabic ? 'الخدمات الجارية للعملاء' : 'Active Client Services'}
        </div>
        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'متابعة الخدمات والمشاريع' : 'Services and Project Tracking'}
        </h1>
        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'هذه الصفحة تقرأ من collection باسم services، أي الخدمات التي تم قبولها من طلبات العملاء.'
            : 'This page reads from the services collection, meaning accepted client service requests.'}
        </p>
      </div>

      {message && <Feedback tone="blue" message={message} onClose={() => setMessage('')} />}
      {error && <Feedback tone="red" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard label={isArabic ? 'كل الخدمات الجارية' : 'All Active Services'} value={stats.total} />
        <StatCard label={isArabic ? 'لم تبدأ' : 'Not Started'} value={stats.notStarted} />
        <StatCard label={isArabic ? 'قيد التنفيذ' : 'In Progress'} value={stats.inProgress} />
        <StatCard label={isArabic ? 'مكتملة' : 'Completed'} value={stats.completed} />
      </div>

      <Card>
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isArabic ? 'right-4' : 'left-4'}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث عن خدمة، عميل، شركة...' : 'Search service, client, company...'}
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
            />
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">{isArabic ? 'كل الحالات' : 'All statuses'}</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {isArabic ? status.ar : status.en}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="py-10 text-center text-gray-500">{isArabic ? 'جاري تحميل الخدمات الجارية...' : 'Loading active services...'}</p>}

        {!loading && filteredServices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد خدمات جارية' : 'No active services'}
            </h3>
          </div>
        )}

        {!loading && filteredServices.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="w-[18%] px-3 py-4 text-start font-black">{isArabic ? 'العميل' : 'Client'}</th>
                  <th className="w-[20%] px-3 py-4 text-start font-black">{isArabic ? 'الخدمة' : 'Service'}</th>
                  <th className="w-[13%] px-3 py-4 text-start font-black">{isArabic ? 'الحالة' : 'Status'}</th>
                  <th className="w-[15%] px-3 py-4 text-start font-black">{isArabic ? 'التقدم' : 'Progress'}</th>
                  <th className="w-[16%] px-3 py-4 text-start font-black">{isArabic ? 'المسؤول / القسم' : 'Owner / Department'}</th>
                  <th className="w-[10%] px-3 py-4 text-start font-black">{isArabic ? 'التسليم' : 'Delivery'}</th>
                  <th className="w-[8%] px-3 py-4 text-start font-black">{isArabic ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredServices.map((service) => {
                  const progress = Math.max(0, Math.min(100, Number(service.progress || 0)));

                  return (
                    <tr key={service.id} className="align-top transition hover:bg-blue-50/50">
                      <td className="px-3 py-4">
                        <p className="truncate font-black text-gray-950">{textOrDash(service.companyName || service.clientName)}</p>
                        <p className="mt-1 truncate text-[11px] font-bold text-gray-500">{textOrDash(service.clientName)}</p>
                        <p className="mt-1 truncate text-[11px] text-gray-400">{textOrDash(service.clientEmail)}</p>
                      </td>

                      <td className="px-3 py-4">
                        <p className="line-clamp-2 font-black text-gray-900">{textOrDash(isArabic ? service.serviceNameAr : service.serviceNameEn)}</p>
                        <p className="mt-1 truncate text-[11px] font-bold text-gray-500">{textOrDash(isArabic ? service.planNameAr : service.planNameEn)}</p>
                      </td>

                      <td className="px-3 py-4">
                        <span className={`inline-flex max-w-full rounded-full px-2 py-1 text-[11px] font-black ${statusTone(service.status)}`}>
                          {getStatusLabel(service.status, isArabic)}
                        </span>
                      </td>

                      <td className="px-3 py-4">
                        <span className="text-[11px] font-bold text-gray-500">{progress}%</span>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                        </div>
                      </td>

                      <td className="px-3 py-4">
                        <p className="truncate font-bold text-gray-800">{textOrDash(service.owner)}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{textOrDash(service.department)}</p>
                      </td>

                      <td className="px-3 py-4">
                        <p className="truncate font-bold text-gray-700">{textOrDash(service.expectedDeliveryDate)}</p>
                        <p className="mt-1 truncate text-[11px] text-gray-400">
                          {service.startDate ? `${isArabic ? 'بداية' : 'Start'}: ${service.startDate}` : '-'}
                        </p>
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex flex-col gap-2">
                          <button type="button" onClick={() => setSelectedService(service)} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700" title={isArabic ? 'تفاصيل' : 'Details'}>
                            <Eye className="h-4 w-4" />
                          </button>

                          <button type="button" onClick={() => openEdit(service)} className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white hover:bg-amber-600" title={isArabic ? 'تحديث' : 'Update'}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedService && <DetailsModal service={selectedService} isArabic={isArabic} onClose={() => setSelectedService(null)} onEdit={() => openEdit(selectedService)} />}
      {editingService && form && <EditModal isArabic={isArabic} form={form} saving={saving} service={editingService} role={role || ''} profileDepartment={profile?.department || ''} onClose={() => { setEditingService(null); setForm(null); }} onSubmit={saveService} updateForm={updateForm} />}
    </div>
  );
};

function EditModal({
  isArabic,
  form,
  saving,
  service,
  role,
  profileDepartment,
  onClose,
  onSubmit,
  updateForm,
}: {
  isArabic: boolean;
  form: EditForm;
  saving: boolean;
  service: ActiveServiceRecord;
  role: string;
  profileDepartment: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  updateForm: <K extends keyof EditForm>(key: K, value: EditForm[K]) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">{isArabic ? 'تحديث الخدمة الجارية' : 'Update Active Service'}</h2>
            <p className="mt-1 text-sm text-gray-500">{isArabic ? service.serviceNameAr : service.serviceNameEn}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={isArabic ? 'الحالة' : 'Status'}>
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value as ServiceStatus)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{isArabic ? status.ar : status.en}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? 'نسبة التقدم' : 'Progress'}>
            <input type="number" min={0} max={100} value={form.progress} onChange={(e) => updateForm('progress', Number(e.target.value))} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label={isArabic ? 'المسؤول' : 'Owner'}>
            <input value={form.owner} disabled={role === 'owner'} onChange={(e) => updateForm('owner', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
          </Field>
          <Field label={isArabic ? 'القسم' : 'Department'}>
            <select value={form.department} disabled={role === 'department_head'} onChange={(e) => updateForm('department', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
              {(role === 'department_head' && profileDepartment ? [profileDepartment] : departments).map((department) => <option key={department}>{department}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? 'تاريخ البداية' : 'Start Date'}>
            <input type="date" value={form.startDate} onChange={(e) => updateForm('startDate', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label={isArabic ? 'تاريخ التسليم المتوقع' : 'Expected Delivery Date'}>
            <input type="date" value={form.expectedDeliveryDate} onChange={(e) => updateForm('expectedDeliveryDate', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>

        <Field label={isArabic ? 'ملاحظة الإدارة' : 'Admin Note'} className="mt-4">
          <textarea value={form.adminNote} onChange={(e) => updateForm('adminNote', e.target.value)} rows={4} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label={isArabic ? 'ملاحظة الفريق' : 'Team Note'} className="mt-4">
          <textarea value={form.teamNote} onChange={(e) => updateForm('teamNote', e.target.value)} rows={4} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-5 py-3 font-bold text-gray-700 hover:bg-gray-200">{isArabic ? 'إلغاء' : 'Cancel'}</button>
          <button disabled={saving} className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ التحديث' : 'Save Update')}</button>
        </div>
      </form>
    </div>
  );
}

function DetailsModal({ service, isArabic, onClose, onEdit }: { service: ActiveServiceRecord; isArabic: boolean; onClose: () => void; onEdit: () => void }) {
  const items = [
    [isArabic ? 'الشركة' : 'Company', service.companyName],
    [isArabic ? 'العميل' : 'Client', service.clientName],
    [isArabic ? 'البريد' : 'Email', service.clientEmail],
    [isArabic ? 'الخدمة' : 'Service', isArabic ? service.serviceNameAr : service.serviceNameEn],
    [isArabic ? 'الباقة' : 'Plan', isArabic ? service.planNameAr : service.planNameEn],
    [isArabic ? 'السعر' : 'Price', isArabic ? service.planPriceAr : service.planPriceEn],
    [isArabic ? 'الحالة' : 'Status', getStatusLabel(service.status, isArabic)],
    [isArabic ? 'التقدم' : 'Progress', `${Number(service.progress || 0)}%`],
    [isArabic ? 'المسؤول' : 'Owner', service.owner],
    [isArabic ? 'القسم' : 'Department', service.department],
    [isArabic ? 'ملاحظة الإدارة' : 'Admin Note', service.adminNote],
    [isArabic ? 'ملاحظة الفريق' : 'Team Note', service.teamNote],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">{isArabic ? 'تفاصيل الخدمة الجارية' : 'Active Service Details'}</h2>
            <p className="mt-1 text-sm text-gray-500">{isArabic ? service.serviceNameAr : service.serviceNameEn}</p>
          </div>
          <button onClick={onClose} className="rounded-2xl bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map(([label, value]) => <Info key={String(label)} label={String(label)} value={value} />)}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onEdit} className="rounded-2xl bg-amber-500 px-5 py-3 font-bold text-white hover:bg-amber-600">{isArabic ? 'تحديث' : 'Update'}</button>
          <button onClick={onClose} className="rounded-2xl bg-gray-100 px-5 py-3 font-bold text-gray-700 hover:bg-gray-200">{isArabic ? 'إغلاق' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-black text-gray-700">{label}</span>{children}</label>;
}

function Info({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-2xl bg-gray-50 p-4"><p className="text-xs font-bold text-gray-400">{label}</p><p className="mt-1 break-words font-black text-gray-900">{textOrDash(value)}</p></div>;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"><p className="text-sm font-bold text-gray-500">{label}</p><p className="mt-3 text-4xl font-black text-gray-950">{value}</p></div>;
}

function Feedback({ tone, message, onClose }: { tone: 'blue' | 'red'; message: string; onClose: () => void }) {
  const cls = tone === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-red-200 bg-red-50 text-red-700';
  return <div className={`rounded-2xl border px-5 py-4 font-bold ${cls}`}><div className="flex items-start justify-between gap-4"><p>{message}</p><button onClick={onClose}>×</button></div></div>;
}
