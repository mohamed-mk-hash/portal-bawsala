import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  BriefcaseBusiness,
  Eye,
  Plus,
  Search,
  Tag,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

type ServiceForm = {
  type: string;
  name: string;
  domain: string;
  price: number;
};

type AvailableService = Partial<ServiceForm> & {
  id: string;
  recordType?: string;
  currency?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type DetailItem = [label: string, value: unknown, ltr?: boolean];

type Option = {
  value: string;
  label: string;
};

const serviceTypes = [
  'موقع إلكتروني',
  'متجر إلكتروني',
  'تسويق رقمي',
  'تصميم',
  'محتوى',
  'تدريب',
  'مناهج وبرامج',
  'حقائب تدريبية',
  'تطوير إداري',
  'خدمة إضافية',
];

const serviceDomains = [
  'قسم إدارة المواقع',
  'قسم إدارة منصات التواصل الاجتماعي',
  'قسم المناهج والبرامج',
  'قسم إعداد الحقائب التدريبية',
  'قسم التطوير الإداري',
  'منتجات بوصلة',
  'الخدمات الإضافية',
];

const emptyForm: ServiceForm = {
  type: serviceTypes[0],
  name: '',
  domain: serviceDomains[0],
  price: 0,
};

const ltrValueClass =
  'inline-block text-left [direction:ltr] [unicode-bidi:plaintext]';

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const makeOptions = (values: string[]): Option[] =>
  values.map((value) => ({ value, label: value || '-' }));

const formatMoney = (amount: number, currency = 'DZD') => {
  return `${Number(amount || 0).toLocaleString()} ${currency}`;
};

export const CurrentServices: React.FC = () => {
  const { isArabic } = useLanguage();

  const [services, setServices] = useState<AvailableService[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<AvailableService | null>(null);

  useEffect(() => {
    const servicesQuery = query(
      collection(db, 'availableServices'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      servicesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as AvailableService[];

        setServices(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setError(
          isArabic
            ? 'تعذر تحميل الخدمات. تحقق من صلاحيات Firestore.'
            : 'Could not load services. Check Firestore permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [isArabic]);

  const filteredServices = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return services;

    return services.filter((service) =>
      [service.type, service.name, service.domain, service.price]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text)
    );
  }, [services, search]);

  const totalValue = services.reduce(
    (sum, service) => sum + Number(service.price || 0),
    0
  );

  const updateForm = <K extends keyof ServiceForm>(
    key: K,
    value: ServiceForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openAddModal = () => {
    setMessage('');
    setError('');
    setForm(emptyForm);
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (saving) return;
    setIsAddModalOpen(false);
  };

  const createService = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');

      if (!form.name.trim()) {
        setError(isArabic ? 'أدخل اسم الخدمة.' : 'Please enter the service name.');
        return;
      }

      if (!form.type.trim()) {
        setError(isArabic ? 'اختر نوع الخدمة.' : 'Please choose the service type.');
        return;
      }

      if (!form.domain.trim()) {
        setError(isArabic ? 'اختر مجال الخدمة.' : 'Please choose the service domain.');
        return;
      }

      await addDoc(collection(db, 'availableServices'), {
        recordType: 'availableService',
        type: form.type.trim(),
        name: form.name.trim(),
        domain: form.domain.trim(),
        price: Number(form.price || 0),
        currency: 'DZD',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage(isArabic ? 'تمت إضافة الخدمة بنجاح.' : 'Service added successfully.');
      setForm(emptyForm);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error(error);
      setError(isArabic ? 'حدث خطأ أثناء إضافة الخدمة.' : 'Failed to add the service.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <BriefcaseBusiness className="h-4 w-4" />
            {isArabic ? 'إدارة الخدمات' : 'Service Management'}
          </div>
          <h1 className="mt-4 text-3xl font-black text-gray-950">
            {isArabic ? 'الخدمات' : 'Services'}
          </h1>
          <p className="mt-2 text-gray-500">
            {isArabic
              ? 'أضف الخدمات المتوفرة في شركة بوصلة حتى يتم اختيارها لاحقاً عند إنشاء صفقة.'
              : 'Add Bawsala services here so they can be selected later when creating deals.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {isArabic ? 'إضافة خدمة' : 'Add Service'}
        </button>
      </div>

      {message && <Feedback tone="blue" message={message} onClose={() => setMessage('')} />}
      {error && <Feedback tone="red" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard label={isArabic ? 'إجمالي الخدمات' : 'Total Services'} value={services.length.toString()} />
        <StatCard label={isArabic ? 'أنواع الخدمات' : 'Service Types'} value={new Set(services.map((item) => item.type).filter(Boolean)).size.toString()} />
        <StatCard label={isArabic ? 'المجالات' : 'Domains'} value={new Set(services.map((item) => item.domain).filter(Boolean)).size.toString()} />
        <StatCard label={isArabic ? 'إجمالي الأسعار' : 'Total Prices'} value={formatMoney(totalValue)} ltr />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? 'جدول الخدمات' : 'Service Table'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'قائمة مختصرة للخدمات المتوفرة مع إمكانية فتح التفاصيل.'
                : 'A compact list of available services with details popup.'}
            </p>
          </div>

          <div className="relative w-full lg:w-96">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isArabic ? 'right-4' : 'left-4'}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث عن خدمة...' : 'Search service...'}
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
            />
          </div>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الخدمات...' : 'Loading services...'}
          </p>
        )}

        {!loading && filteredServices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد خدمات بعد' : 'No services yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {isArabic ? 'اضغط إضافة خدمة لإضافة أول خدمة.' : 'Click Add Service to add the first service.'}
            </p>
          </div>
        )}

        {!loading && filteredServices.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <TableHead label={isArabic ? 'النوع' : 'Type'} />
                    <TableHead label={isArabic ? 'الإسم' : 'Name'} />
                    <TableHead label={isArabic ? 'المجال' : 'Domain'} />
                    <TableHead label={isArabic ? 'السعر' : 'Price'} />
                    <TableHead label={isArabic ? 'التفاصيل' : 'Details'} />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="transition hover:bg-blue-50/50">
                      <TableCell strong value={textOrDash(service.type)} />
                      <TableCell value={textOrDash(service.name)} />
                      <TableCell value={textOrDash(service.domain)} />
                      <TableCell ltr value={formatMoney(Number(service.price || 0), service.currency || 'DZD')} />
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedService(service)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                          {isArabic ? 'التفاصيل' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {isAddModalOpen && (
        <AddServiceModal
          isArabic={isArabic}
          form={form}
          saving={saving}
          onClose={closeAddModal}
          onSubmit={createService}
          updateForm={updateForm}
        />
      )}

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          isArabic={isArabic}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  );
};

function AddServiceModal({
  isArabic,
  form,
  saving,
  onClose,
  onSubmit,
  updateForm,
}: {
  isArabic: boolean;
  form: ServiceForm;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  updateForm: <K extends keyof ServiceForm>(key: K, value: ServiceForm[K]) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-none items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-950">
                {isArabic ? 'إضافة خدمة جديدة' : 'Add New Service'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {isArabic
                  ? 'أدخل بيانات الخدمة المتوفرة داخل شركة بوصلة.'
                  : 'Enter the available service information.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <FormSection title={isArabic ? 'بيانات الخدمة' : 'Service Information'} icon={<Tag className="h-5 w-5" />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label={isArabic ? 'النوع' : 'Type'}
                value={form.type}
                onChange={(value) => updateForm('type', value)}
                options={makeOptions(serviceTypes)}
                required
              />
              <TextField
                label={isArabic ? 'الإسم' : 'Name'}
                value={form.name}
                onChange={(value) => updateForm('name', value)}
                required
              />
              <SelectField
                label={isArabic ? 'المجال' : 'Domain'}
                value={form.domain}
                onChange={(value) => updateForm('domain', value)}
                options={makeOptions(serviceDomains)}
                required
              />
              <NumberField
                label={isArabic ? 'السعر' : 'Price'}
                value={form.price}
                onChange={(value) => updateForm('price', value)}
                min={0}
              />
            </div>
          </FormSection>
        </div>

        <div className="flex flex-none flex-col gap-3 border-t border-gray-100 bg-gray-50 p-6 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            disabled={saving}
            className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? isArabic
                ? 'جاري الحفظ...'
                : 'Saving...'
              : isArabic
                ? 'حفظ الخدمة'
                : 'Save Service'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ServiceDetailsModal({
  service,
  isArabic,
  onClose,
}: {
  service: AvailableService;
  isArabic: boolean;
  onClose: () => void;
}) {
  const details: DetailItem[] = [
    [isArabic ? 'النوع' : 'Type', service.type],
    [isArabic ? 'الإسم' : 'Name', service.name],
    [isArabic ? 'المجال' : 'Domain', service.domain],
    [isArabic ? 'السعر' : 'Price', formatMoney(Number(service.price || 0), service.currency || 'DZD'), true],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div dir={isArabic ? 'rtl' : 'ltr'} className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-sm font-bold text-blue-600">
              {isArabic ? 'تفاصيل الخدمة' : 'Service Details'}
            </p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">
              {textOrDash(service.name)}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {textOrDash(service.domain)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-112px)] overflow-y-auto p-6">
          <DetailsSection title={isArabic ? 'بيانات الخدمة' : 'Service Information'} items={details} />
        </div>
      </div>
    </div>
  );
}

function Feedback({ tone, message, onClose }: { tone: 'blue' | 'red'; message: string; onClose?: () => void }) {
  const styles = tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700';
  return (
    <div className={`rounded-2xl border px-5 py-4 font-medium ${styles}`}>
      <div className="flex items-start justify-between gap-4">
        <p>{message}</p>
        {onClose && <button type="button" onClick={onClose} className="font-bold opacity-70 hover:opacity-100">×</button>}
      </div>
    </div>
  );
}

function StatCard({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <Card>
      <p className="text-sm font-bold text-gray-500">{label}</p>
      <p dir={ltr ? 'ltr' : undefined} className={`mt-2 text-2xl font-black text-gray-950 ${ltr ? ltrValueClass : ''}`}>
        {value}
      </p>
    </Card>
  );
}

function TableHead({ label }: { label: string }) {
  return <th className="whitespace-nowrap px-5 py-4 text-start text-xs font-black uppercase tracking-wide">{label}</th>;
}

function TableCell({ value, strong, ltr }: { value: string; strong?: boolean; ltr?: boolean }) {
  return (
    <td className={`max-w-[300px] whitespace-nowrap px-5 py-4 ${strong ? 'font-black text-gray-950' : 'font-medium text-gray-700'}`} title={value}>
      <span dir={ltr ? 'ltr' : undefined} className={`block overflow-hidden text-ellipsis ${ltr ? ltrValueClass : ''}`}>{value}</span>
    </td>
  );
}

function DetailsSection({ title, items }: { title: string; items: DetailItem[] }) {
  return (
    <div className="rounded-3xl border border-gray-100 p-5">
      <h3 className="mb-4 font-black text-gray-950">{title}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map(([label, value, ltr]) => (
          <div key={label} className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">{label}</p>
            <p dir={ltr ? 'ltr' : undefined} className={`mt-1 break-words font-bold text-gray-900 ${ltr ? ltrValueClass : ''}`}>{textOrDash(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-100 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">{icon}</div>
        <h3 className="font-black text-gray-950">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </div>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">{label}</label>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: Option[]; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
        {options.map((item) => <option key={`${item.value}-${item.label}`} value={item.value}>{item.label}</option>)}
      </select>
    </div>
  );
}
