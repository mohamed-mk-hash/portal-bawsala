import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Eye,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { SEED_SOURCE, seedClients, seedDeals } from '../data/clientSeeds';

type ClientRecord = {
  id: string;
  recordType?: string;
  organizationName?: string;
  companyEmail?: string;
  companyPhone?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  country?: string;
  city?: string;
  seedSource?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type DealForm = {
  clientId: string;
  pipeline: string;
  stage: string;
  probability: number;
  dealTitle: string;
  dealStatus: string;
  priority: string;
  leadSource: string;
  leadScore: number;
  customerTemperature: string;
  decisionMaker: string;
  budgetRange: string;
  productService: string;
  dealValue: number;
  currency: string;
  expectedCloseDate: string;
  renewalDate: string;
  contractDuration: string;
  paymentTerms: string;
  activityType: string;
  activitySubject: string;
  activityDueDate: string;
  activityStatus: string;
  owner: string;
  department: string;
  tags: string;
  competitor: string;
  nextAction: string;
  notes: string;
};

type DealRecord = Partial<DealForm> & {
  id: string;
  dealId?: string;
  recordType?: string;
  clientName?: string;
  companyName?: string;
  clientEmail?: string;
  clientPhone?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  seedSource?: string;
  sourceRow?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type DetailItem = [label: string, value: unknown];

type Option = {
  value: string;
  label: string;
};

const pipelines = [
  'مواقع وتطوير',
  'تسويق رقمي',
  'مناهج وتدريب',
  'تصميم الحقائب التدريبية',
  'تطوير إداري',
  'إعداد الحقائب التدريبية',
  'المناهج والبرامج',
];

const stages = [
  'QA ومراجعة',
  'إعداد الحقيبة الكاملة',
  'استشارة أولية',
  'استفسار',
  'تحليل الاحتياج',
  'تحليل الاحتياج التدريبي',
  'تحليل المتطلبات',
  'تسليم نهائي',
  'تسليم وتقييم',
  'تسليم ودعم',
  'تشخيص المؤسسة',
  'تصميم المحتوى العلمي',
  'تصميم المنهج',
  'تصميم وتطوير',
  'تصميم وكتابة',
  'تعديلات وإتمام',
  'تنفيذ الدورة',
  'تنفيذ نشط',
  'تنفيذ ومتابعة',
  'طلب البرنامج',
  'طلب الحقيبة',
  'طلب المنهج',
  'عرض الحلول',
  'عرض مقدم',
  'عرض وعقد',
  'عقد موقّع',
  'عقد وتخطيط',
  'عميل محتمل',
  'مراجعة العميل',
];

const productsServices = [
  'تصميم موقع ووردبريس',
  'تطوير متجر إلكتروني',
  'برمجة لعبة تعليمية',
  'لوحة تحكم مخصصة',
  'تحيين وصيانة الموقع',
  'تقرير أداء Google Analytics',
  'فحص الأداء التقني',
  'نشر مقال / محتوى',
  'باقة نحاسية - إدارة منصات التواصل',
  'باقة فضية - إدارة منصات التواصل',
  'باقة ذهبية - إدارة منصات التواصل',
  'إنتاج فيديو قصير (60 ثانية)',
  'تركيب ومونتاج فيديو',
  'تصميم منفرد إعلاني',
  'خطة حملة ترويجية',
  'كتابة سكريبت فيديو',
  'إدارة إعلانات ممولة',
  'كتابة محتوى تسويقي',
  'تصميم منهج تدريبي كامل',
  'المادة العلمية للدورة',
  'شرائح عرض تدريبية',
  'دليل المدرب',
  'دليل المتدرب',
  'تنفيذ دورة تدريبية عن بعد',
  'تنفيذ دورة تدريبية حضورية',
  'بطاقة تعليمية',
  'تقييم بنموذج كيركباتريك',
  'تصميم حقيبة تدريبية كاملة',
  'مفتاح الحقيبة التدريبية',
  'المنهجية التفصيلية للحقيبة',
  'ملحق النماذج والتمارين',
  'كتيب مسابقة',
  'دليل رقمي (15-20 صفحة)',
  'أوراق تمارين',
  'تصميم المحتوى العلمي للحقيبة',
  'تطوير عرض تعريفي بمشروع',
  'إعداد خطة عمل مشروع',
  'تطوير لائحة / سياسة تنظيمية',
  'تقرير تطوير إداري',
  'تنظيم ملفات مؤسسية',
  'عرض فني لخدمات بوصلة',
  'استبيان / استمارة توظيف',
  'اجتماع تنسيق وتخطيط',
  'تقرير أداء سنوي',
];

const leadSources = [
  'إحالة',
  'تسويق رقمي',
  'شبكة العلاقات',
  'موقع الويب',
  'سوشيال ميديا',
  'بريد إلكتروني',
  'داخلي',
  'أخرى',
];

const owners = [
  'سيرين لويز',
  'آمال بوعبدالله',
  'جهاد رحيل عباسي',
  'بلال بوعيشة',
  'محمد لمين مختاري',
  'منار قدادرة',
  'نسرين بن دقيش',
  'مريم مقري',
];

const departments = [
  'قسم إدارة المواقع',
  'قسم إدارة منصات التواصل الاجتماعي',
  'قسم المناهج والبرامج',
  'قسم التطوير الإداري',
  'منتجات بوصلة',
  'الخدمات الإضافية',
];

const nextActions = [
  'متابعة رد العميل',
  'إرسال العرض المالي',
  'توقيع العقد',
  'جدولة اجتماع',
  'تنفيذ قائمة QA',
  'إرسال فاتورة',
  'إرسال تقرير أداء',
  'عرض تجديد العقد',
  'متابعة الدفع',
  'اجتماع متابعة أسبوعي',
  'إرسال استبيان رضا',
  'مراجعة المحتوى العلمي',
];

const currencies = ['DZD', 'USD', 'EUR', 'SAR', 'AED', 'KWD', 'TRY', 'CNY'];
const priorities = ['High', 'Medium', 'Low'];
const dealStatuses = ['Open', 'Won', 'Lost'];
const customerTemperatures = ['Hot', 'Warm', 'Cold'];
const decisionMakerOptions = ['Yes', 'No', 'Unknown'];
const contractDurations = ['شهري', 'ربعي', 'نصف سنوي', 'سنوي', 'مشروع واحد'];
const paymentTerms = ['دفعة واحدة', 'دفعتين', 'ثلاث دفعات', 'شهري'];
const activityTypes = ['Call', 'Meeting', 'Task', 'Email', 'Lunch', 'Deadline'];
const activityStatuses = ['Done', 'Undone'];

const emptyForm: DealForm = {
  clientId: '',
  pipeline: 'مواقع وتطوير',
  stage: 'عميل محتمل',
  probability: 0,
  dealTitle: '',
  dealStatus: 'Open',
  priority: 'Medium',
  leadSource: 'إحالة',
  leadScore: 0,
  customerTemperature: 'Warm',
  decisionMaker: 'Unknown',
  budgetRange: '',
  productService: 'تصميم موقع ووردبريس',
  dealValue: 0,
  currency: 'DZD',
  expectedCloseDate: '',
  renewalDate: '',
  contractDuration: 'مشروع واحد',
  paymentTerms: 'دفعتين',
  activityType: 'Task',
  activitySubject: '',
  activityDueDate: '',
  activityStatus: 'Undone',
  owner: '',
  department: '',
  tags: '',
  competitor: '',
  nextAction: 'متابعة رد العميل',
  notes: '',
};

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const makeOptions = (values: string[]): Option[] =>
  values.map((value) => ({ value, label: value || '-' }));

const getClientName = (client?: ClientRecord) => textOrDash(client?.organizationName);
const getDealClientName = (deal: DealRecord) => textOrDash(deal.clientName || deal.companyName);
const getDealTitle = (deal: DealRecord) => textOrDash(deal.dealTitle || deal.productService);

const formatMoney = (amount: number, currency?: string) => {
  return `${Number(amount || 0).toLocaleString()} ${currency || 'DZD'}`;
};

const localizedStatus = (value: string | undefined, isArabic: boolean) => {
  const labels: Record<string, { ar: string; en: string }> = {
    Open: { ar: 'مفتوحة', en: 'Open' },
    Won: { ar: 'ناجحة', en: 'Won' },
    Lost: { ar: 'ضائعة', en: 'Lost' },
  };
  if (!value) return '-';
  return isArabic ? labels[value]?.ar || value : labels[value]?.en || value;
};

const localizedPriority = (value: string | undefined, isArabic: boolean) => {
  const labels: Record<string, { ar: string; en: string }> = {
    High: { ar: 'عالية', en: 'High' },
    Medium: { ar: 'متوسطة', en: 'Medium' },
    Low: { ar: 'منخفضة', en: 'Low' },
  };
  if (!value) return '-';
  return isArabic ? labels[value]?.ar || value : labels[value]?.en || value;
};

const localizedTemperature = (value: string | undefined, isArabic: boolean) => {
  const labels: Record<string, { ar: string; en: string }> = {
    Hot: { ar: 'ساخن', en: 'Hot' },
    Warm: { ar: 'دافئ', en: 'Warm' },
    Cold: { ar: 'بارد', en: 'Cold' },
  };
  if (!value) return '-';
  return isArabic ? labels[value]?.ar || value : labels[value]?.en || value;
};

const localizedDecisionMaker = (value: string | undefined, isArabic: boolean) => {
  const labels: Record<string, { ar: string; en: string }> = {
    Yes: { ar: 'نعم', en: 'Yes' },
    No: { ar: 'لا', en: 'No' },
    Unknown: { ar: 'غير معروف', en: 'Unknown' },
  };
  if (!value) return '-';
  return isArabic ? labels[value]?.ar || value : labels[value]?.en || value;
};

export const Deals: React.FC = () => {
  const { isArabic } = useLanguage();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<DealForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealRecord | null>(null);

  const seedAttemptedRef = useRef(false);
  const seedRunningRef = useRef(false);

  const importDealsFromFile = async () => {
    if (seedRunningRef.current) return;

    try {
      seedAttemptedRef.current = true;
      seedRunningRef.current = true;
      setSeeding(true);
      setError('');

      const batch = writeBatch(db);

      seedClients.forEach((client) => {
        batch.set(
          doc(db, 'clients', client.clientId),
          {
            ...client,
            seedSource: SEED_SOURCE,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      seedDeals.forEach((deal) => {
        batch.set(
          doc(db, 'deals', deal.dealId),
          {
            ...deal,
            seedSource: SEED_SOURCE,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();

      setMessage(
        isArabic
          ? `تم إدخال ${seedDeals.length} صفقة وربطها بالعملاء الموجودين.`
          : `${seedDeals.length} deals were imported and linked to existing clients.`
      );
    } catch (error) {
      console.error(error);
      setError(
        isArabic
          ? 'تعذر إدخال الصفقات تلقائياً. تحقق من صلاحيات Firestore.'
          : 'Could not import deals automatically. Check Firestore permissions.'
      );
    } finally {
      seedRunningRef.current = false;
      setSeeding(false);
    }
  };

  useEffect(() => {
    const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'));
    const dealsQuery = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));

    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as ClientRecord[];
      setClients(data.filter((client) => client.recordType === 'client'));
    });

    const unsubscribeDeals = onSnapshot(
      dealsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as DealRecord[];
        setDeals(data.filter((deal) => deal.recordType === 'deal' || !deal.recordType));
        setLoading(false);

        const alreadySeeded = data.some((deal) => deal.seedSource === SEED_SOURCE);
        if (!alreadySeeded && !seedAttemptedRef.current) {
          importDealsFromFile();
        }
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setError(
          isArabic
            ? 'تعذر تحميل الصفقات. تحقق من صلاحيات Firestore.'
            : 'Could not load deals. Check Firestore permissions.'
        );
      }
    );

    return () => {
      unsubscribeClients();
      unsubscribeDeals();
    };
  }, [isArabic]);

  const filteredDeals = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return deals;

    return deals.filter((deal) => {
      const searchableText = [
        deal.clientName,
        deal.companyName,
        deal.dealTitle,
        deal.pipeline,
        deal.stage,
        deal.productService,
        deal.dealStatus,
        deal.priority,
        deal.contactName,
        deal.owner,
        deal.nextAction,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(text);
    });
  }, [deals, search]);

  const openCount = deals.filter((deal) => deal.dealStatus === 'Open').length;
  const wonCount = deals.filter((deal) => deal.dealStatus === 'Won').length;
  const lostCount = deals.filter((deal) => deal.dealStatus === 'Lost').length;

  const updateForm = <K extends keyof DealForm>(key: K, value: DealForm[K]) => {
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

  const createDeal = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const selectedClient = clients.find((client) => client.id === form.clientId);

      if (!selectedClient) {
        setError(isArabic ? 'اختر عميل موجود أولاً.' : 'Please select an existing client first.');
        return;
      }

      if (!form.dealTitle.trim()) {
        setError(isArabic ? 'أدخل عنوان الصفقة.' : 'Please enter the deal title.');
        return;
      }

      await addDoc(collection(db, 'deals'), {
        recordType: 'deal',
        ...form,
        clientId: selectedClient.id,
        clientName: selectedClient.organizationName || '',
        companyName: selectedClient.organizationName || '',
        clientEmail: selectedClient.companyEmail || selectedClient.primaryContactEmail || '',
        clientPhone: selectedClient.companyPhone || selectedClient.primaryContactPhone || '',
        contactName: selectedClient.primaryContactName || '',
        contactEmail: selectedClient.primaryContactEmail || '',
        contactPhone: selectedClient.primaryContactPhone || '',
        dealTitle: form.dealTitle.trim(),
        budgetRange: form.budgetRange.trim(),
        activitySubject: form.activitySubject.trim(),
        competitor: form.competitor.trim(),
        notes: form.notes.trim(),
        probability: Number(form.probability || 0),
        leadScore: Number(form.leadScore || 0),
        dealValue: Number(form.dealValue || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage(isArabic ? 'تمت إضافة الصفقة بنجاح.' : 'Deal added successfully.');
      setForm(emptyForm);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error(error);
      setError(isArabic ? 'حدث خطأ أثناء إضافة الصفقة.' : 'Failed to add the deal.');
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
            {isArabic ? 'إدارة الصفقات' : 'Deal Management'}
          </div>
          <h1 className="mt-4 text-3xl font-black text-gray-950">{isArabic ? 'الصفقات' : 'Deals'}</h1>
          <p className="mt-2 text-gray-500">
            {isArabic
              ? 'هذه الصفحة خاصة بالصفقات فقط. عند إضافة صفقة اختر عميلاً موجوداً بدلاً من إعادة إدخال بياناته.'
              : 'This page is only for deals. When adding a deal, select an existing client instead of re-entering client data.'}
          </p>
        </div>

        <button type="button" onClick={openAddModal} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">
          <Plus className="h-5 w-5" />
          {isArabic ? 'إضافة صفقة' : 'Add Deal'}
        </button>
      </div>

      {message && <Feedback tone="blue" message={message} onClose={() => setMessage('')} />}
      {error && <Feedback tone="red" message={error} onClose={() => setError('')} />}
      {seeding && <Feedback tone="blue" message={isArabic ? 'جاري إدخال الصفقات من ملف نظام العملاء...' : 'Importing deals from the client system file...'} />}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard label={isArabic ? 'إجمالي الصفقات' : 'Total Deals'} value={deals.length.toString()} />
        <StatCard label={isArabic ? 'صفقات مفتوحة' : 'Open Deals'} value={openCount.toString()} />
        <StatCard label={isArabic ? 'صفقات ناجحة' : 'Won Deals'} value={wonCount.toString()} />
        <StatCard label={isArabic ? 'صفقات ضائعة' : 'Lost Deals'} value={lostCount.toString()} />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">{isArabic ? 'جدول الصفقات' : 'Deal Table'}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic ? 'يعرض الجدول أهم معلومات الصفقة، وباقي التفاصيل داخل النافذة.' : 'The table shows key deal information, with full details inside the popup.'}
            </p>
          </div>
          <div className="relative w-full lg:w-96">
            <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isArabic ? 'right-4' : 'left-4'}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث عن صفقة أو عميل...' : 'Search deal or client...'}
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
            />
          </div>
        </div>

        {loading && <p className="py-10 text-center text-gray-500">{isArabic ? 'جاري تحميل الصفقات...' : 'Loading deals...'}</p>}

        {!loading && filteredDeals.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">{isArabic ? 'لا توجد صفقات بعد' : 'No deals yet'}</h3>
            <p className="mt-2 text-sm text-gray-500">{isArabic ? 'اضغط إضافة صفقة لإنشاء صفقة من عميل موجود.' : 'Click Add Deal to create a deal from an existing client.'}</p>
          </div>
        )}

        {!loading && filteredDeals.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <TableHead label={isArabic ? 'العميل' : 'Client'} />
                    <TableHead label={isArabic ? 'عنوان الصفقة' : 'Deal Title'} />
                    <TableHead label={isArabic ? 'الحالة' : 'Status'} />
                    <TableHead label={isArabic ? 'القيمة' : 'Value'} />
                    <TableHead label={isArabic ? 'الشخص المسؤول' : 'Contact'} />
                    <TableHead label={isArabic ? 'التفاصيل' : 'Details'} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredDeals.map((deal) => (
                    <tr key={deal.id} className="transition hover:bg-blue-50/50">
                      <TableCell strong value={getDealClientName(deal)} />
                      <TableCell value={getDealTitle(deal)} />
                      <td className="px-5 py-4"><StatusBadge value={deal.dealStatus || ''} isArabic={isArabic} /></td>
                      <TableCell value={formatMoney(Number(deal.dealValue || 0), deal.currency)} />
                      <TableCell value={textOrDash(deal.contactName)} />
                      <td className="whitespace-nowrap px-5 py-4">
                        <button type="button" onClick={() => setSelectedDeal(deal)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700">
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
        <AddDealModal
          isArabic={isArabic}
          clients={clients}
          form={form}
          saving={saving}
          onClose={closeAddModal}
          onSubmit={createDeal}
          updateForm={updateForm}
        />
      )}

      {selectedDeal && (
        <DealDetailsModal deal={selectedDeal} isArabic={isArabic} onClose={() => setSelectedDeal(null)} />
      )}
    </div>
  );
};

function AddDealModal({
  isArabic,
  clients,
  form,
  saving,
  onClose,
  onSubmit,
  updateForm,
}: {
  isArabic: boolean;
  clients: ClientRecord[];
  form: DealForm;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  updateForm: <K extends keyof DealForm>(key: K, value: DealForm[K]) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-none items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600"><Plus className="h-6 w-6" /></div>
            <div>
              <h2 className="text-xl font-black text-gray-950">{isArabic ? 'إضافة صفقة جديدة' : 'Add New Deal'}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {isArabic ? 'اختر عميلاً موجوداً ثم أدخل بيانات الصفقة فقط.' : 'Select an existing client, then enter deal information only.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <FormSection title={isArabic ? 'اختيار العميل' : 'Client Selection'} icon={<Building2 className="h-5 w-5" />}>
            <ClientSearchSelect
              label={isArabic ? 'العميل' : 'Client'}
              value={form.clientId}
              clients={clients}
              isArabic={isArabic}
              onChange={(value) => updateForm('clientId', value)}
            />
          </FormSection>

          <FormSection title={isArabic ? 'بيانات الصفقة' : 'Deal Information'} icon={<BriefcaseBusiness className="h-5 w-5" />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SelectField label="Pipeline" value={form.pipeline} onChange={(value) => updateForm('pipeline', value)} options={makeOptions(pipelines)} />
              <SelectField label={isArabic ? 'المرحلة' : 'Stage'} value={form.stage} onChange={(value) => updateForm('stage', value)} options={makeOptions(stages)} />
              <NumberField label={isArabic ? 'نسبة الاحتمال' : 'Probability'} value={form.probability} onChange={(value) => updateForm('probability', value)} min={0} max={100} />
              <TextField label={isArabic ? 'عنوان الصفقة' : 'Deal Title'} value={form.dealTitle} onChange={(value) => updateForm('dealTitle', value)} required />
              <SelectField label={isArabic ? 'حالة الصفقة' : 'Deal Status'} value={form.dealStatus} onChange={(value) => updateForm('dealStatus', value)} options={dealStatuses.map((value) => ({ value, label: localizedStatus(value, isArabic) }))} />
              <SelectField label={isArabic ? 'الأولوية' : 'Priority'} value={form.priority} onChange={(value) => updateForm('priority', value)} options={priorities.map((value) => ({ value, label: localizedPriority(value, isArabic) }))} />
            </div>
          </FormSection>

          <FormSection title={isArabic ? 'المبيعات والتعاقد' : 'Sales & Contract'} icon={<BadgeCheck className="h-5 w-5" />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SelectField label={isArabic ? 'مصدر العميل' : 'Lead Source'} value={form.leadSource} onChange={(value) => updateForm('leadSource', value)} options={makeOptions(leadSources)} />
              <NumberField label={isArabic ? 'درجة العميل' : 'Lead Score'} value={form.leadScore} onChange={(value) => updateForm('leadScore', value)} min={0} max={100} />
              <SelectField label={isArabic ? 'حرارة العميل' : 'Customer Temperature'} value={form.customerTemperature} onChange={(value) => updateForm('customerTemperature', value)} options={customerTemperatures.map((value) => ({ value, label: localizedTemperature(value, isArabic) }))} />
              <SelectField label={isArabic ? 'صاحب القرار' : 'Decision Maker'} value={form.decisionMaker} onChange={(value) => updateForm('decisionMaker', value)} options={decisionMakerOptions.map((value) => ({ value, label: localizedDecisionMaker(value, isArabic) }))} />
              <TextField label={isArabic ? 'نطاق الميزانية' : 'Budget Range'} value={form.budgetRange} onChange={(value) => updateForm('budgetRange', value)} />
              <SelectField label={isArabic ? 'المنتج / الخدمة' : 'Product / Service'} value={form.productService} onChange={(value) => updateForm('productService', value)} options={makeOptions(productsServices)} />
              <NumberField label={isArabic ? 'قيمة الصفقة' : 'Deal Value'} value={form.dealValue} onChange={(value) => updateForm('dealValue', value)} min={0} />
              <SelectField label={isArabic ? 'العملة' : 'Currency'} value={form.currency} onChange={(value) => updateForm('currency', value)} options={makeOptions(currencies)} />
              <DateField label={isArabic ? 'تاريخ الإغلاق المتوقع' : 'Expected Close Date'} value={form.expectedCloseDate} onChange={(value) => updateForm('expectedCloseDate', value)} />
              <DateField label={isArabic ? 'تاريخ التجديد' : 'Renewal Date'} value={form.renewalDate} onChange={(value) => updateForm('renewalDate', value)} />
              <SelectField label={isArabic ? 'مدة العقد' : 'Contract Duration'} value={form.contractDuration} onChange={(value) => updateForm('contractDuration', value)} options={makeOptions(contractDurations)} />
              <SelectField label={isArabic ? 'شروط الدفع' : 'Payment Terms'} value={form.paymentTerms} onChange={(value) => updateForm('paymentTerms', value)} options={makeOptions(paymentTerms)} />
            </div>
          </FormSection>

          <FormSection title={isArabic ? 'النشاط والمتابعة' : 'Activity & Follow-up'} icon={<ClipboardList className="h-5 w-5" />}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SelectField label={isArabic ? 'نوع النشاط' : 'Activity Type'} value={form.activityType} onChange={(value) => updateForm('activityType', value)} options={makeOptions(activityTypes)} />
              <TextField label={isArabic ? 'موضوع النشاط' : 'Activity Subject'} value={form.activitySubject} onChange={(value) => updateForm('activitySubject', value)} />
              <DateField label={isArabic ? 'تاريخ النشاط' : 'Activity Due Date'} value={form.activityDueDate} onChange={(value) => updateForm('activityDueDate', value)} />
              <SelectField label={isArabic ? 'حالة النشاط' : 'Activity Status'} value={form.activityStatus} onChange={(value) => updateForm('activityStatus', value)} options={makeOptions(activityStatuses)} />
              <SelectField label={isArabic ? 'المسؤول' : 'Owner'} value={form.owner} onChange={(value) => updateForm('owner', value)} options={makeOptions(['', ...owners])} />
              <SelectField label={isArabic ? 'القسم' : 'Department'} value={form.department} onChange={(value) => updateForm('department', value)} options={makeOptions(['', ...departments])} />
              <TextField label={isArabic ? 'وسوم' : 'Tags'} value={form.tags} onChange={(value) => updateForm('tags', value)} />
              <TextField label={isArabic ? 'المنافس' : 'Competitor'} value={form.competitor} onChange={(value) => updateForm('competitor', value)} />
              <SelectField label={isArabic ? 'الإجراء القادم' : 'Next Action'} value={form.nextAction} onChange={(value) => updateForm('nextAction', value)} options={makeOptions(nextActions)} />
              <div className="md:col-span-3"><TextareaField label={isArabic ? 'ملاحظات' : 'Notes'} value={form.notes} onChange={(value) => updateForm('notes', value)} /></div>
            </div>
          </FormSection>
        </div>

        <div className="flex flex-none flex-col gap-3 border-t border-gray-100 bg-gray-50 p-6 sm:flex-row">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50">{isArabic ? 'إلغاء' : 'Cancel'}</button>
          <button disabled={saving} className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : isArabic ? 'حفظ الصفقة' : 'Save Deal'}</button>
        </div>
      </form>
    </div>
  );
}

function ClientSearchSelect({
  label,
  value,
  clients,
  isArabic,
  onChange,
}: {
  label: string;
  value: string;
  clients: ClientRecord[];
  isArabic: boolean;
  onChange: (value: string) => void;
}) {
  const selectedClient = clients.find((client) => client.id === value);
  const [queryText, setQueryText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = selectedClient
    ? `${getClientName(selectedClient)}${selectedClient.companyEmail ? ` - ${selectedClient.companyEmail}` : ''}`
    : '';

  useEffect(() => {
    if (!isOpen) {
      setQueryText(selectedLabel);
    }
  }, [isOpen, selectedLabel]);

  const filteredClients = useMemo(() => {
    const text = queryText.trim().toLowerCase();
    if (!text) return clients.slice(0, 12);

    return clients
      .filter((client) =>
        [
          client.organizationName,
          client.companyEmail,
          client.companyPhone,
          client.primaryContactName,
          client.primaryContactEmail,
          client.country,
          client.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(text)
      )
      .slice(0, 12);
  }, [clients, queryText]);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-bold text-gray-700">{label}</label>
      <input type="hidden" value={value} required />
      <input
        value={isOpen ? queryText : selectedLabel}
        onFocus={() => {
          setIsOpen(true);
          setQueryText('');
        }}
        onChange={(e) => {
          setQueryText(e.target.value);
          if (value) onChange('');
        }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        placeholder={isArabic ? 'ابحث واختر عميلاً موجوداً...' : 'Search and select an existing client...'}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />

      {isOpen && (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
          {filteredClients.length === 0 ? (
            <p className="px-4 py-3 text-sm font-bold text-gray-400">
              {isArabic ? 'لا يوجد عميل مطابق.' : 'No matching client.'}
            </p>
          ) : (
            filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(client.id);
                  setQueryText(`${getClientName(client)}${client.companyEmail ? ` - ${client.companyEmail}` : ''}`);
                  setIsOpen(false);
                }}
                className="w-full rounded-xl px-4 py-3 text-start hover:bg-blue-50"
              >
                <p className="font-black text-gray-900">{getClientName(client)}</p>
                <p className="mt-1 text-xs font-bold text-gray-500">
                  {[client.companyEmail, client.primaryContactName, client.country].filter(Boolean).join(' • ') || '-'}
                </p>
              </button>
            ))
          )}
        </div>
      )}

      {selectedClient && (
        <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-700">
          {isArabic ? 'العميل المختار:' : 'Selected client:'} {getClientName(selectedClient)}
        </div>
      )}
    </div>
  );
}

function DealDetailsModal({ deal, isArabic, onClose }: { deal: DealRecord; isArabic: boolean; onClose: () => void }) {
  const dealDetails: DetailItem[] = [
    [isArabic ? 'العميل' : 'Client', getDealClientName(deal)],
    [isArabic ? 'عنوان الصفقة' : 'Deal Title', deal.dealTitle],
    ['Pipeline', deal.pipeline],
    [isArabic ? 'المرحلة' : 'Stage', deal.stage],
    [isArabic ? 'الحالة' : 'Status', localizedStatus(deal.dealStatus, isArabic)],
    [isArabic ? 'الأولوية' : 'Priority', localizedPriority(deal.priority, isArabic)],
    [isArabic ? 'نسبة الاحتمال' : 'Probability', `${Number(deal.probability || 0)}%`],
    [isArabic ? 'الخدمة' : 'Product / Service', deal.productService],
    [isArabic ? 'قيمة الصفقة' : 'Deal Value', formatMoney(Number(deal.dealValue || 0), deal.currency)],
  ];

  const contractDetails: DetailItem[] = [
    [isArabic ? 'تاريخ الإغلاق المتوقع' : 'Expected Close Date', deal.expectedCloseDate],
    [isArabic ? 'تاريخ التجديد' : 'Renewal Date', deal.renewalDate],
    [isArabic ? 'مدة العقد' : 'Contract Duration', deal.contractDuration],
    [isArabic ? 'شروط الدفع' : 'Payment Terms', deal.paymentTerms],
    [isArabic ? 'نطاق الميزانية' : 'Budget Range', deal.budgetRange],
  ];

  const contactDetails: DetailItem[] = [
    [isArabic ? 'الشخص المسؤول' : 'Contact Name', deal.contactName],
    [isArabic ? 'البريد' : 'Email', deal.contactEmail || deal.clientEmail],
    [isArabic ? 'الهاتف' : 'Phone', deal.contactPhone || deal.clientPhone],
    [isArabic ? 'مصدر العميل' : 'Lead Source', deal.leadSource],
    [isArabic ? 'درجة العميل' : 'Lead Score', deal.leadScore],
    [isArabic ? 'حرارة العميل' : 'Customer Temperature', localizedTemperature(deal.customerTemperature, isArabic)],
    [isArabic ? 'صاحب القرار' : 'Decision Maker', localizedDecisionMaker(deal.decisionMaker, isArabic)],
  ];

  const activityDetails: DetailItem[] = [
    [isArabic ? 'نوع النشاط' : 'Activity Type', deal.activityType],
    [isArabic ? 'موضوع النشاط' : 'Activity Subject', deal.activitySubject],
    [isArabic ? 'تاريخ النشاط' : 'Activity Due Date', deal.activityDueDate],
    [isArabic ? 'حالة النشاط' : 'Activity Status', deal.activityStatus],
    [isArabic ? 'المسؤول' : 'Owner', deal.owner],
    [isArabic ? 'القسم' : 'Department', deal.department],
    [isArabic ? 'وسوم' : 'Tags', deal.tags],
    [isArabic ? 'المنافس' : 'Competitor', deal.competitor],
    [isArabic ? 'الإجراء القادم' : 'Next Action', deal.nextAction],
    [isArabic ? 'ملاحظات' : 'Notes', deal.notes],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div dir={isArabic ? 'rtl' : 'ltr'} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-sm font-bold text-blue-600">{isArabic ? 'تفاصيل الصفقة' : 'Deal Details'}</p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">{getDealTitle(deal)}</h2>
            <p className="mt-1 text-sm text-gray-500">{getDealClientName(deal)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(92vh-112px)] space-y-5 overflow-y-auto p-6">
          <DetailsSection title={isArabic ? 'بيانات الصفقة' : 'Deal Information'} items={dealDetails} />
          <DetailsSection title={isArabic ? 'بيانات التعاقد' : 'Contract Information'} items={contractDetails} />
          <DetailsSection title={isArabic ? 'بيانات التواصل' : 'Contact Information'} items={contactDetails} />
          <DetailsSection title={isArabic ? 'النشاط والمتابعة' : 'Activity & Follow-up'} items={activityDetails} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ value, isArabic }: { value: string; isArabic: boolean }) {
  const styles: Record<string, string> = {
    Open: 'bg-yellow-100 text-yellow-700',
    Won: 'bg-green-100 text-green-700',
    Lost: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[value] || 'bg-gray-100 text-gray-700'}`}>{localizedStatus(value, isArabic)}</span>;
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm font-bold text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-gray-950">{value}</p>
    </Card>
  );
}

function TableHead({ label }: { label: string }) {
  return <th className="whitespace-nowrap px-5 py-4 text-start text-xs font-black uppercase tracking-wide">{label}</th>;
}

function TableCell({ value, strong }: { value: string; strong?: boolean }) {
  return (
    <td className={`max-w-[300px] whitespace-nowrap px-5 py-4 ${strong ? 'font-black text-gray-950' : 'font-medium text-gray-700'}`} title={value}>
      <span className="block overflow-hidden text-ellipsis">{value}</span>
    </td>
  );
}

function DetailsSection({ title, items }: { title: string; items: DetailItem[] }) {
  return (
    <div className="rounded-3xl border border-gray-100 p-5">
      <h3 className="mb-4 font-black text-gray-950">{title}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">{label}</p>
            <p className="mt-1 break-words font-bold text-gray-900">{textOrDash(value)}</p>
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

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
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

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </div>
  );
}
