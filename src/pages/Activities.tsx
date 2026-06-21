import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import type { ActivityRecord, DealRecord } from '../types/adminDashboard';
import { useAuth } from '../auth/AuthContext';

type ActivityForm = {
  subject: string;
  type: string;
  dueDate: string;
  status: 'Done' | 'Undone';
  department: string;
  owner: string;
  nextAction: string;
  notes: string;
  dealId: string;
};

const activityTypes = ['Task', 'Call', 'Meeting', 'Email', 'Deadline'];
const statuses = ['Undone', 'Done'] as const;

const departments = [
  'قسم إدارة المواقع',
  'قسم إدارة منصات التواصل الاجتماعي',
  'قسم المناهج والبرامج',
  'قسم إعداد الحقائب التدريبية',
  'قسم التطوير الإداري',
  'منتجات بوصلة',
  'الخدمات الإضافية',
];

const emptyForm: ActivityForm = {
  subject: '',
  type: 'Task',
  dueDate: '',
  status: 'Undone',
  department: departments[0],
  owner: '',
  nextAction: '',
  notes: '',
  dealId: '',
};

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
};

const isOverdue = (activity: ActivityRecord) => {
  return Boolean(
    activity.dueDate &&
      activity.dueDate < todayIso() &&
      activity.status !== 'Done'
  );
};

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

export const Activities: React.FC = () => {
  const { isArabic } = useLanguage();
  const { profile, role, user } = useAuth();

  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ActivityForm>(emptyForm);

  useEffect(() => {
    const unsubscribeActivities = onSnapshot(
      query(collection(db, 'activities'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setActivities(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as ActivityRecord[]
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
        setError(
          isArabic
            ? 'تعذر تحميل المهام. تحقق من صلاحيات Firestore.'
            : 'Could not load activities. Check Firestore permissions.'
        );
      }
    );

    const unsubscribeDeals = onSnapshot(
      query(collection(db, 'deals'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setDeals(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as DealRecord[]
        );
      }
    );

    return () => {
      unsubscribeActivities();
      unsubscribeDeals();
    };
  }, [isArabic]);

  const canSeeActivity = (activity: ActivityRecord) => {
    if (role === 'admin' || role === 'super_admin') return true;

    if (role === 'department_head') {
      return Boolean(
        profile?.department &&
          activity.department === profile.department
      );
    }

    if (role === 'owner') {
      return Boolean(
        activity.ownerUid === user?.uid ||
          activity.ownerEmail === user?.email ||
          activity.owner === profile?.ownerName ||
          activity.owner === profile?.fullName
      );
    }

    return false;
  };

  const canSeeDeal = (deal: DealRecord) => {
    if (role === 'admin' || role === 'super_admin') return true;

    if (role === 'department_head') {
      return Boolean(
        profile?.department &&
          deal.department === profile.department
      );
    }

    if (role === 'owner') {
      return Boolean(
        deal.ownerUid === user?.uid ||
          deal.ownerEmail === user?.email ||
          deal.owner === profile?.ownerName ||
          deal.owner === profile?.fullName
      );
    }

    return false;
  };

  const visibleActivities = useMemo<ActivityRecord[]>(() => {
    return activities.filter(canSeeActivity);
  }, [activities, role, profile, user]);

  const visibleDeals = useMemo<DealRecord[]>(() => {
    return deals.filter(canSeeDeal);
  }, [deals, role, profile, user]);

  const owners = useMemo(() => {
    return Array.from(
      new Set(visibleActivities.map((item) => item.owner).filter(Boolean))
    ) as string[];
  }, [visibleActivities]);

  const filteredActivities = useMemo<ActivityRecord[]>(() => {
    const text = search.trim().toLowerCase();

    return visibleActivities.filter((activity: ActivityRecord) => {
      const matchesText =
        !text ||
        [
          activity.subject,
          activity.dealTitle,
          activity.clientName,
          activity.department,
          activity.owner,
          activity.nextAction,
          activity.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text);

      const matchesStatus =
        statusFilter === 'all' ||
        activity.status === statusFilter ||
        (statusFilter === 'overdue' && isOverdue(activity));

      const matchesDepartment =
        departmentFilter === 'all' ||
        activity.department === departmentFilter;

      const matchesOwner =
        ownerFilter === 'all' || activity.owner === ownerFilter;

      return (
        matchesText &&
        matchesStatus &&
        matchesDepartment &&
        matchesOwner
      );
    });
  }, [
    visibleActivities,
    search,
    statusFilter,
    departmentFilter,
    ownerFilter,
  ]);

  const stats = useMemo(() => {
    return {
      total: visibleActivities.length,
      done: visibleActivities.filter(
        (item: ActivityRecord) => item.status === 'Done'
      ).length,
      undone: visibleActivities.filter(
        (item: ActivityRecord) => item.status !== 'Done'
      ).length,
      overdue: visibleActivities.filter(isOverdue).length,
    };
  }, [visibleActivities]);

  const updateForm = <K extends keyof ActivityForm>(
    key: K,
    value: ActivityForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateModal = () => {
    setForm({
      ...emptyForm,
      department:
        role === 'department_head' && profile?.department
          ? profile.department
          : emptyForm.department,
      owner:
        role === 'owner'
          ? profile?.ownerName || profile?.fullName || ''
          : '',
    });
    setMessage('');
    setError('');
    setShowModal(true);
  };

  const createActivity = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError('');
      setMessage('');

      if (!form.subject.trim()) {
        setError(
          isArabic
            ? 'أدخل موضوع المهمة.'
            : 'Please enter the activity subject.'
        );
        return;
      }

      if (!form.dueDate) {
        setError(
          isArabic
            ? 'حدد تاريخ الاستحقاق.'
            : 'Please set the due date.'
        );
        return;
      }

      if (
        role === 'department_head' &&
        profile?.department &&
        form.department !== profile.department
      ) {
        setError(
          isArabic
            ? 'لا يمكنك إنشاء مهمة خارج قسمك.'
            : 'You cannot create an activity outside your department.'
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
            ? 'لا يمكنك إنشاء مهمة باسم مسؤول آخر.'
            : 'You cannot create an activity for another owner.'
        );
        return;
      }

      const selectedDeal = visibleDeals.find(
        (deal) => deal.id === form.dealId
      );

      await addDoc(collection(db, 'activities'), {
        recordType: 'activity',
        subject: form.subject.trim(),
        type: form.type,
        dueDate: form.dueDate,
        status: form.status,
        department: form.department,
        owner: form.owner.trim(),
        ownerUid: user?.uid || '',
        ownerEmail: user?.email || '',
        nextAction: form.nextAction.trim(),
        notes: form.notes.trim(),
        dealId: selectedDeal?.id || '',
        dealTitle:
          selectedDeal?.dealTitle || selectedDeal?.productService || '',
        clientId: selectedDeal?.clientId || '',
        clientName:
          selectedDeal?.clientName || selectedDeal?.companyName || '',
        pipeline: selectedDeal?.pipeline || '',
        source: 'manual_admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage(
        isArabic
          ? 'تمت إضافة المهمة بنجاح.'
          : 'Activity added successfully.'
      );
      setForm(emptyForm);
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError(
        isArabic
          ? 'حدث خطأ أثناء إضافة المهمة.'
          : 'Failed to add activity.'
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    activity: ActivityRecord,
    status: 'Done' | 'Undone'
  ) => {
    try {
      await updateDoc(doc(db, 'activities', activity.id), {
        status,
        completedAt: status === 'Done' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setError(
        isArabic
          ? 'تعذر تحديث حالة المهمة.'
          : 'Could not update activity status.'
      );
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <ClipboardList className="h-4 w-4" />
            {isArabic ? 'إدارة المهام والأنشطة' : 'Task and Activity Management'}
          </div>
          <h1 className="mt-4 text-3xl font-black text-gray-950">
            {isArabic ? 'المهام اليومية' : 'Daily Activities'}
          </h1>
          <p className="mt-2 text-gray-500">
            {isArabic
              ? 'تابع المهام حسب القسم والمسؤول وتاريخ الاستحقاق، مع إبراز المتأخر تلقائياً.'
              : 'Track tasks by department, owner, and due date with automatic overdue highlighting.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {isArabic ? 'إضافة مهمة' : 'Add Activity'}
        </button>
      </div>

      {message && <Feedback tone="blue" message={message} onClose={() => setMessage('')} />}
      {error && <Feedback tone="red" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard label={isArabic ? 'كل المهام' : 'All Activities'} value={stats.total} />
        <StatCard label={isArabic ? 'منجزة' : 'Done'} value={stats.done} />
        <StatCard label={isArabic ? 'غير منجزة' : 'Undone'} value={stats.undone} />
        <StatCard label={isArabic ? 'متأخرة' : 'Overdue'} value={stats.overdue} danger />
      </div>

      <Card>
        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_auto_auto] xl:items-center">
          <div className="relative">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isArabic ? 'right-4' : 'left-4'}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث عن مهمة، صفقة، عميل...' : 'Search activity, deal, client...'}
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
            />
          </div>

          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[
            ['all', isArabic ? 'كل الحالات' : 'All statuses'],
            ['Undone', isArabic ? 'غير منجزة' : 'Undone'],
            ['Done', isArabic ? 'منجزة' : 'Done'],
            ['overdue', isArabic ? 'متأخرة' : 'Overdue'],
          ]} />

          <FilterSelect value={departmentFilter} onChange={setDepartmentFilter} options={[
            ['all', isArabic ? 'كل الأقسام' : 'All departments'],
            ...departments.map((department) => [department, department] as [string, string]),
          ]} />

          <FilterSelect value={ownerFilter} onChange={setOwnerFilter} options={[
            ['all', isArabic ? 'كل المسؤولين' : 'All owners'],
            ...owners.map((owner) => [owner, owner] as [string, string]),
          ]} />
        </div>

        {loading && <p className="py-10 text-center text-gray-500">{isArabic ? 'جاري تحميل المهام...' : 'Loading activities...'}</p>}

        {!loading && filteredActivities.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد مهام مطابقة' : 'No matching activities'}
            </h3>
          </div>
        )}

        {!loading && filteredActivities.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <TableHead label={isArabic ? 'موضوع النشاط' : 'Subject'} />
                    <TableHead label={isArabic ? 'الصفقة / العميل' : 'Deal / Client'} />
                    <TableHead label={isArabic ? 'القسم' : 'Department'} />
                    <TableHead label={isArabic ? 'المسؤول' : 'Owner'} />
                    <TableHead label={isArabic ? 'تاريخ الاستحقاق' : 'Due Date'} />
                    <TableHead label={isArabic ? 'الحالة' : 'Status'} />
                    <TableHead label={isArabic ? 'الإجراء القادم' : 'Next Action'} />
                    <TableHead label={isArabic ? 'تحديث' : 'Update'} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredActivities.map((activity) => {
                    const overdue = isOverdue(activity);
                    return (
                      <tr key={activity.id} className={overdue ? 'bg-red-50/60' : 'hover:bg-blue-50/40'}>
                        <td className="px-5 py-4 font-black text-gray-950">
                          <div className="flex items-center gap-2">
                            {overdue && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            {textOrDash(activity.subject)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          <p className="font-bold text-gray-900">{textOrDash(activity.dealTitle)}</p>
                          <p className="text-xs text-gray-500">{textOrDash(activity.clientName)}</p>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{textOrDash(activity.department)}</td>
                        <td className="px-5 py-4 text-gray-600">{textOrDash(activity.owner)}</td>
                        <td className={`px-5 py-4 font-black ${overdue ? 'text-red-700' : 'text-gray-700'}`}>{textOrDash(activity.dueDate)}</td>
                        <td className="px-5 py-4"><StatusBadge status={activity.status || 'Undone'} isArabic={isArabic} /></td>
                        <td className="px-5 py-4 text-gray-600">{textOrDash(activity.nextAction)}</td>
                        <td className="px-5 py-4">
                          {activity.status === 'Done' ? (
                            <button onClick={() => updateStatus(activity, 'Undone')} className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-black text-gray-700 hover:bg-gray-200">
                              {isArabic ? 'إرجاع' : 'Undo'}
                            </button>
                          ) : (
                            <button onClick={() => updateStatus(activity, 'Done')} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-black text-white hover:bg-green-700">
                              <CheckCircle2 className="h-4 w-4" />
                              {isArabic ? 'تم' : 'Done'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {showModal && (
        <ActivityModal
          isArabic={isArabic}
          form={form}
          deals={visibleDeals}
          saving={saving}
          role={role || ''}
          profileDepartment={profile?.department || ''}
          onClose={() => setShowModal(false)}
          onSubmit={createActivity}
          updateForm={updateForm}
        />
      )}
    </div>
  );
};

function ActivityModal({
  isArabic,
  form,
  deals,
  saving,
  role,
  profileDepartment,
  onClose,
  onSubmit,
  updateForm,
}: {
  isArabic: boolean;
  form: ActivityForm;
  deals: DealRecord[];
  saving: boolean;
  role: string;
  profileDepartment: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  updateForm: <K extends keyof ActivityForm>(key: K, value: ActivityForm[K]) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-950">{isArabic ? 'إضافة مهمة جديدة' : 'Add New Activity'}</h2>
            <p className="mt-1 text-sm text-gray-500">{isArabic ? 'يمكن ربط المهمة بصفقة محددة أو تركها كمهمة عامة.' : 'You can link the activity to a deal or keep it general.'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={isArabic ? 'موضوع النشاط' : 'Subject'}>
            <input value={form.subject} onChange={(e) => updateForm('subject', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label={isArabic ? 'نوع النشاط' : 'Type'}>
            <select value={form.type} onChange={(e) => updateForm('type', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
              {activityTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}>
            <input type="date" value={form.dueDate} onChange={(e) => updateForm('dueDate', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label={isArabic ? 'الحالة' : 'Status'}>
            <select value={form.status} onChange={(e) => updateForm('status', e.target.value as 'Done' | 'Undone')} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? 'القسم' : 'Department'}>
            <select
              value={form.department}
              disabled={role === 'department_head'}
              onChange={(e) => updateForm('department', e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {(role === 'department_head' && profileDepartment
                ? [profileDepartment]
                : departments
              ).map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label={isArabic ? 'المسؤول' : 'Owner'}>
            <input value={form.owner} onChange={(e) => updateForm('owner', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label={isArabic ? 'الصفقة المرتبطة' : 'Related Deal'}>
            <select value={form.dealId} onChange={(e) => updateForm('dealId', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{isArabic ? 'بدون صفقة' : 'No deal'}</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>{deal.clientName || deal.companyName || '-'} - {deal.dealTitle || deal.productService || '-'}</option>
              ))}
            </select>
          </Field>
          <Field label={isArabic ? 'الإجراء القادم' : 'Next Action'}>
            <input value={form.nextAction} onChange={(e) => updateForm('nextAction', e.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>

        <Field label={isArabic ? 'ملاحظات' : 'Notes'} className="mt-4">
          <textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} rows={4} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 px-5 py-3 font-bold text-gray-700 hover:bg-gray-200">{isArabic ? 'إلغاء' : 'Cancel'}</button>
          <button disabled={saving} className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'حفظ المهمة' : 'Save Activity')}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-black text-gray-700">{label}</span>{children}</label>;
}

function StatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  const done = status === 'Done';
  return <span className={`rounded-full px-3 py-1 text-xs font-black ${done ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{done ? (isArabic ? 'منجزة' : 'Done') : (isArabic ? 'غير منجزة' : 'Undone')}</span>;
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500">{options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}</select>;
}

function TableHead({ label }: { label: string }) {
  return <th className="whitespace-nowrap px-5 py-4 text-start font-black">{label}</th>;
}

function StatCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"><p className="text-sm font-bold text-gray-500">{label}</p><p className={`mt-3 text-4xl font-black ${danger ? 'text-red-600' : 'text-gray-950'}`}>{value}</p></div>;
}

function Feedback({ tone, message, onClose }: { tone: 'blue' | 'red'; message: string; onClose: () => void }) {
  const cls = tone === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-red-200 bg-red-50 text-red-700';
  return <div className={`rounded-2xl border px-5 py-4 font-bold ${cls}`}><div className="flex items-start justify-between gap-4"><p>{message}</p><button onClick={onClose}>×</button></div></div>;
}
