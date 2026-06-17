import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Building2,
  Eye,
  Pencil,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import { SEED_SOURCE, seedClients } from '../data/clientSeeds';
import type { SeedContact } from '../data/clientSeeds';

type ClientForm = {
  organizationName: string;
  industry: string;
  companySize: string;
  country: string;
  city: string;
  hasWebsite: string;
  website: string;
  companyPhone: string;
  companyEmail: string;
  primaryContactName: string;
  primaryContactJobTitle: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  leadSource: string;
  leadScore: number;
  customerTemperature: string;
  decisionMaker: string;
  budgetRange: string;
  notes: string;
};

type ClientRecord = Partial<ClientForm> & {
  id: string;
  clientId?: string;
  recordType?: string;
  label?: string;
  contacts?: SeedContact[];
  seedSource?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type DetailItem = [label: string, value: unknown, ltr?: boolean];

type Option = {
  value: string;
  label: string;
};

const industries = [
  'منظمة غير ربحية',
  'منظمة دولية',
  'قطاع خاص',
  'مركز تدريبي',
  'حكومي',
  'أخرى',
];

const companySizes = ['1-10', '10-50', '50-200', '200-500', '500+'];

const countries = [
  'الجزائر',
  'المغرب',
  'تونس',
  'فلسطين',
  'السعودية',
  'الإمارات',
  'قطر',
  'الكويت',
  'الأردن',
  'تركيا',
  'الصين',
  'كندا',
  'سوريا',
  'دولي',
  'أخرى',
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

const jobTitles = [
  'مدير عام',
  'مديرة عامة',
  'مدير المشاريع',
  'مدير التدريب والتطوير',
  'مؤسس ورئيس الشركة',
  'مستشار ومدرب معتمد',
  'دكتور ومدرب معتمد',
  'مدير البرامج',
  'مدير الأكاديمية',
  'مدير المحتوى والبرامج',
  'رئيس مجلس الإدارة',
];

const customerTemperatures = ['Hot', 'Warm', 'Cold'];
const decisionMakerOptions = ['Yes', 'No', 'Unknown'];

const emptyForm: ClientForm = {
  organizationName: '',
  industry: 'قطاع خاص',
  companySize: '1-10',
  country: 'الجزائر',
  city: '',
  hasWebsite: 'no',
  website: '',
  companyPhone: '',
  companyEmail: '',
  primaryContactName: '',
  primaryContactJobTitle: 'مدير المشاريع',
  primaryContactEmail: '',
  primaryContactPhone: '',
  leadSource: 'إحالة',
  leadScore: 0,
  customerTemperature: 'Warm',
  decisionMaker: 'Unknown',
  budgetRange: '',
  notes: '',
};

const ltrValueClass =
  'inline-block text-left [direction:ltr] [unicode-bidi:plaintext]';

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const makeOptions = (values: string[]): Option[] =>
  values.map((value) => ({ value, label: value || '-' }));

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

const getClientName = (client: ClientRecord) =>
  textOrDash(client.organizationName || client.label);

const getClientEmail = (client: ClientRecord) =>
  textOrDash(client.companyEmail || client.primaryContactEmail);

const getClientPhone = (client: ClientRecord) =>
  textOrDash(client.companyPhone || client.primaryContactPhone);

const buildContacts = (form: ClientForm): SeedContact[] => {
  if (!form.primaryContactName.trim()) return [];

  return [
    {
      name: form.primaryContactName.trim(),
      jobTitle: form.primaryContactJobTitle,
      email: form.primaryContactEmail.trim(),
      phone: form.primaryContactPhone.trim(),
      decisionMaker: form.decisionMaker,
    },
  ];
};

const buildClientPayload = (form: ClientForm) => {
  return {
    recordType: 'client',
    organizationName: form.organizationName.trim(),
    label: form.organizationName.trim(),
    industry: form.industry,
    companySize: form.companySize,
    country: form.country,
    city: form.city.trim(),
    hasWebsite: form.hasWebsite,
    website: form.hasWebsite === 'yes' ? form.website.trim() : '',
    companyPhone: form.companyPhone.trim(),
    companyEmail: form.companyEmail.trim(),
    primaryContactName: form.primaryContactName.trim(),
    primaryContactJobTitle: form.primaryContactJobTitle,
    primaryContactEmail: form.primaryContactEmail.trim(),
    primaryContactPhone: form.primaryContactPhone.trim(),
    leadSource: form.leadSource,
    leadScore: Number(form.leadScore || 0),
    customerTemperature: form.customerTemperature,
    decisionMaker: form.decisionMaker,
    budgetRange: form.budgetRange.trim(),
    notes: form.notes.trim(),
    contacts: buildContacts(form),
    updatedAt: serverTimestamp(),
  };
};

const fillFormFromClient = (client: ClientRecord): ClientForm => {
  const firstContact = client.contacts?.[0];

  return {
    organizationName: client.organizationName || client.label || '',
    industry: client.industry || 'قطاع خاص',
    companySize: client.companySize || '1-10',
    country: client.country || 'الجزائر',
    city: client.city || '',
    hasWebsite: client.website ? 'yes' : client.hasWebsite || 'no',
    website: client.website || '',
    companyPhone: client.companyPhone || '',
    companyEmail: client.companyEmail || '',
    primaryContactName:
      client.primaryContactName || firstContact?.name || '',
    primaryContactJobTitle:
      client.primaryContactJobTitle || firstContact?.jobTitle || 'مدير المشاريع',
    primaryContactEmail:
      client.primaryContactEmail || firstContact?.email || '',
    primaryContactPhone:
      client.primaryContactPhone || firstContact?.phone || '',
    leadSource: client.leadSource || 'إحالة',
    leadScore: Number(client.leadScore || 0),
    customerTemperature: client.customerTemperature || 'Warm',
    decisionMaker:
      client.decisionMaker || firstContact?.decisionMaker || 'Unknown',
    budgetRange: client.budgetRange || '',
    notes: client.notes || '',
  };
};

export const Clients: React.FC = () => {
  const { isArabic } = useLanguage();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);

  const seedAttemptedRef = useRef(false);
  const seedRunningRef = useRef(false);

  const importClientsFromFile = async () => {
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

      await batch.commit();

      setMessage(
        isArabic
          ? `تم إدخال ${seedClients.length} عميل من ملف نظام العملاء.`
          : `${seedClients.length} clients were imported from the client system file.`
      );
    } catch (error) {
      console.error(error);
      setError(
        isArabic
          ? 'تعذر إدخال العملاء تلقائياً. تحقق من صلاحيات Firestore.'
          : 'Could not import clients automatically. Check Firestore permissions.'
      );
    } finally {
      seedRunningRef.current = false;
      setSeeding(false);
    }
  };

  useEffect(() => {
    const clientsQuery = query(
      collection(db, 'clients'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const allData = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ClientRecord[];

        const clientOnlyData = allData.filter((client) => {
          return (
            client.recordType === 'client' ||
            (!client.recordType && !('dealTitle' in client) && !('pipeline' in client))
          );
        });

        setClients(clientOnlyData);
        setLoadingClients(false);

        const alreadySeeded = clientOnlyData.some(
          (client) => client.seedSource === SEED_SOURCE
        );

        if (!alreadySeeded && !seedAttemptedRef.current) {
          importClientsFromFile();
        }
      },
      (error) => {
        console.error(error);
        setLoadingClients(false);
        setError(
          isArabic
            ? 'تعذر تحميل العملاء. تحقق من صلاحيات Firestore.'
            : 'Could not load clients. Check Firestore permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [isArabic]);

  const filteredClients = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return clients;

    return clients.filter((client) => {
      const searchableText = [
        client.organizationName,
        client.label,
        client.country,
        client.city,
        client.companyEmail,
        client.companyPhone,
        client.primaryContactName,
        client.primaryContactEmail,
        client.primaryContactPhone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(text);
    });
  }, [clients, search]);

  const updateForm = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openAddModal = () => {
    setMessage('');
    setError('');
    setEditingClient(null);
    setForm(emptyForm);
    setIsClientModalOpen(true);
  };

  const openEditModal = (client: ClientRecord) => {
    setMessage('');
    setError('');
    setSelectedClient(null);
    setEditingClient(client);
    setForm(fillFormFromClient(client));
    setIsClientModalOpen(true);
  };

  const closeClientModal = () => {
    if (saving) return;
    setIsClientModalOpen(false);
    setEditingClient(null);
    setForm(emptyForm);
  };

  const syncClientDeals = async (client: ClientRecord, updatedForm: ClientForm) => {
    const possibleClientIds = Array.from(
      new Set([client.id, client.clientId].filter(Boolean))
    ) as string[];

    if (possibleClientIds.length === 0) return 0;

    const dealSnapshots = await Promise.all(
      possibleClientIds.map((clientId) =>
        getDocs(
          query(
            collection(db, 'deals'),
            where('clientId', '==', clientId)
          )
        )
      )
    );

    const dealDocs = dealSnapshots.flatMap((snapshot) => snapshot.docs);

    if (dealDocs.length === 0) return 0;

    const batch = writeBatch(db);

    const companyEmail = updatedForm.companyEmail.trim();
    const contactEmail = updatedForm.primaryContactEmail.trim();
    const companyPhone = updatedForm.companyPhone.trim();
    const contactPhone = updatedForm.primaryContactPhone.trim();

    dealDocs.forEach((dealDoc) => {
      batch.update(dealDoc.ref, {
        clientName: updatedForm.organizationName.trim(),
        companyName: updatedForm.organizationName.trim(),
        clientEmail: companyEmail || contactEmail,
        clientPhone: companyPhone || contactPhone,
        contactName: updatedForm.primaryContactName.trim(),
        contactEmail: contactEmail || companyEmail,
        contactPhone: contactPhone || companyPhone,
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();

    return dealDocs.length;
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');

      if (!form.organizationName.trim()) {
        setError(
          isArabic
            ? 'أدخل اسم العميل أو المؤسسة.'
            : 'Please enter the client or organization name.'
        );
        return;
      }

      const payload = buildClientPayload(form);

      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), payload);

        const updatedDealsCount = await syncClientDeals(editingClient, form);

        setMessage(
          isArabic
            ? `تم تعديل العميل بنجاح. تم تحديث ${updatedDealsCount} صفقة مرتبطة.`
            : `Client updated successfully. ${updatedDealsCount} related deals were updated.`
        );
      } else {
        await addDoc(collection(db, 'clients'), {
          ...payload,
          createdAt: serverTimestamp(),
        });

        setMessage(
          isArabic
            ? 'تمت إضافة العميل بنجاح.'
            : 'Client added successfully.'
        );
      }

      setForm(emptyForm);
      setEditingClient(null);
      setIsClientModalOpen(false);
    } catch (error) {
      console.error(error);
      setError(
        editingClient
          ? isArabic
            ? 'حدث خطأ أثناء تعديل العميل.'
            : 'Failed to update the client.'
          : isArabic
            ? 'حدث خطأ أثناء إضافة العميل.'
            : 'Failed to add the client.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <Building2 className="h-4 w-4" />
            {isArabic ? 'إدارة العملاء' : 'Client Management'}
          </div>

          <h1 className="mt-4 text-3xl font-black text-gray-950">
            {isArabic ? 'العملاء' : 'Clients'}
          </h1>

          <p className="mt-2 text-gray-500">
            {isArabic
              ? 'يمكنك إضافة العملاء وتعديل بياناتهم مثل البريد والهاتف، مع تحديث الصفقات المرتبطة تلقائياً.'
              : 'Add and edit client information such as email and phone, with automatic sync to related deals.'}
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {isArabic ? 'إضافة عميل' : 'Add Client'}
        </button>
      </div>

      {message && <Feedback tone="blue" message={message} onClose={() => setMessage('')} />}
      {error && <Feedback tone="red" message={error} onClose={() => setError('')} />}

      {seeding && (
        <Feedback
          tone="blue"
          message={
            isArabic
              ? 'جاري إدخال العملاء من ملف نظام العملاء...'
              : 'Importing clients from the client system file...'
          }
        />
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <StatCard
          label={isArabic ? 'إجمالي العملاء' : 'Total Clients'}
          value={clients.length.toString()}
        />

        <StatCard
          label={isArabic ? 'دول العملاء' : 'Client Countries'}
          value={new Set(clients.map((c) => c.country).filter(Boolean)).size.toString()}
        />

        <StatCard
          label={isArabic ? 'جهات الاتصال' : 'Contacts'}
          value={clients
            .reduce((sum, client) => sum + Math.max(1, client.contacts?.length || 0), 0)
            .toString()}
        />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? 'قائمة العملاء' : 'Client List'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'يعرض الجدول أهم معلومات العميل، ويمكنك فتح التفاصيل أو تعديل البيانات.'
                : 'The table shows key client information. You can view details or edit the client.'}
            </p>
          </div>

          <div className="relative w-full lg:w-96">
            <Search
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${
                isArabic ? 'right-4' : 'left-4'
              }`}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث عن عميل...' : 'Search clients...'}
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'
              }`}
            />
          </div>
        </div>

        {loadingClients && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل العملاء...' : 'Loading clients...'}
          </p>
        )}

        {!loadingClients && filteredClients.length === 0 && (
          <EmptyState isArabic={isArabic} />
        )}

        {!loadingClients && filteredClients.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <TableHead label={isArabic ? 'العميل / المؤسسة' : 'Client / Organization'} />
                    <TableHead label={isArabic ? 'الدولة' : 'Country'} />
                    <TableHead label={isArabic ? 'المدينة' : 'City'} />
                    <TableHead label={isArabic ? 'الهاتف' : 'Phone'} />
                    <TableHead label={isArabic ? 'الشخص المسؤول' : 'Contact'} />
                    <TableHead label={isArabic ? 'الإجراءات' : 'Actions'} />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="transition hover:bg-blue-50/50">
                      <TableCell strong value={getClientName(client)} />
                      <TableCell value={textOrDash(client.country)} />
                      <TableCell value={textOrDash(client.city)} />
                      <TableCell ltr value={getClientPhone(client)} />
                      <TableCell value={textOrDash(client.primaryContactName)} />

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedClient(client)}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                          >
                            <Eye className="h-4 w-4" />
                            {isArabic ? 'التفاصيل' : 'Details'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600"
                          >
                            <Pencil className="h-4 w-4" />
                            {isArabic ? 'تعديل' : 'Edit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {isClientModalOpen && (
        <ClientFormModal
          isArabic={isArabic}
          form={form}
          saving={saving}
          isEditing={Boolean(editingClient)}
          onClose={closeClientModal}
          onSubmit={saveClient}
          updateForm={updateForm}
        />
      )}

      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          isArabic={isArabic}
          onClose={() => setSelectedClient(null)}
          onEdit={() => openEditModal(selectedClient)}
        />
      )}
    </div>
  );
};

function ClientFormModal({
  isArabic,
  form,
  saving,
  isEditing,
  onClose,
  onSubmit,
  updateForm,
}: {
  isArabic: boolean;
  form: ClientForm;
  saving: boolean;
  isEditing: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  updateForm: <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-none items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-600">
              {isEditing ? <Pencil className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </div>

            <div>
              <h2 className="text-xl font-black text-gray-950">
                {isEditing
                  ? isArabic
                    ? 'تعديل العميل'
                    : 'Edit Client'
                  : isArabic
                    ? 'إضافة عميل جديد'
                    : 'Add New Client'}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {isArabic
                  ? 'عدّل بيانات العميل مثل الهاتف والبريد وجهة الاتصال.'
                  : 'Edit client data such as phone, email, and contact person.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <FormSection
            title={isArabic ? 'بيانات المؤسسة' : 'Organization Information'}
            icon={<Building2 className="h-5 w-5" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TextField
                label={isArabic ? 'اسم العميل / المؤسسة' : 'Client / Organization Name'}
                value={form.organizationName}
                onChange={(value) => updateForm('organizationName', value)}
                required
              />

              <SelectField
                label={isArabic ? 'القطاع' : 'Industry'}
                value={form.industry}
                onChange={(value) => updateForm('industry', value)}
                options={makeOptions(industries)}
              />

              <SelectField
                label={isArabic ? 'حجم الشركة' : 'Company Size'}
                value={form.companySize}
                onChange={(value) => updateForm('companySize', value)}
                options={makeOptions(companySizes)}
              />

              <SelectField
                label={isArabic ? 'الدولة' : 'Country'}
                value={form.country}
                onChange={(value) => updateForm('country', value)}
                options={makeOptions(countries)}
              />

              <TextField
                label={isArabic ? 'المدينة' : 'City'}
                value={form.city}
                onChange={(value) => updateForm('city', value)}
              />

              <SelectField
                label={isArabic ? 'هل لدى العميل موقع؟' : 'Does the client have a website?'}
                value={form.hasWebsite}
                onChange={(value) => {
                  updateForm('hasWebsite', value);
                  if (value === 'no') updateForm('website', '');
                }}
                options={[
                  { value: 'no', label: isArabic ? 'لا' : 'No' },
                  { value: 'yes', label: isArabic ? 'نعم' : 'Yes' },
                ]}
              />

              {form.hasWebsite === 'yes' && (
                <TextField
                  label={isArabic ? 'رابط الموقع الإلكتروني' : 'Website Link'}
                  value={form.website}
                  onChange={(value) => updateForm('website', value)}
                />
              )}

              <TextField
                label={isArabic ? 'هاتف الشركة' : 'Company Phone'}
                value={form.companyPhone}
                onChange={(value) => updateForm('companyPhone', value)}
              />

              <TextField
                label={isArabic ? 'بريد الشركة' : 'Company Email'}
                value={form.companyEmail}
                onChange={(value) => updateForm('companyEmail', value)}
              />
            </div>
          </FormSection>

          <FormSection
            title={isArabic ? 'بيانات الشخص المسؤول' : 'Contact Person'}
            icon={<User className="h-5 w-5" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TextField
                label={isArabic ? 'اسم الشخص' : 'Person Name'}
                value={form.primaryContactName}
                onChange={(value) => updateForm('primaryContactName', value)}
              />

              <SelectField
                label={isArabic ? 'المسمى الوظيفي' : 'Job Title'}
                value={form.primaryContactJobTitle}
                onChange={(value) => updateForm('primaryContactJobTitle', value)}
                options={makeOptions(jobTitles)}
              />

              <SelectField
                label={isArabic ? 'صاحب القرار' : 'Decision Maker'}
                value={form.decisionMaker}
                onChange={(value) => updateForm('decisionMaker', value)}
                options={decisionMakerOptions.map((value) => ({
                  value,
                  label: localizedDecisionMaker(value, isArabic),
                }))}
              />

              <TextField
                label={isArabic ? 'بريد الشخص' : 'Person Email'}
                value={form.primaryContactEmail}
                onChange={(value) => updateForm('primaryContactEmail', value)}
              />

              <TextField
                label={isArabic ? 'هاتف الشخص' : 'Person Phone'}
                value={form.primaryContactPhone}
                onChange={(value) => updateForm('primaryContactPhone', value)}
              />

              <SelectField
                label={isArabic ? 'مصدر العميل' : 'Lead Source'}
                value={form.leadSource}
                onChange={(value) => updateForm('leadSource', value)}
                options={makeOptions(leadSources)}
              />

              <NumberField
                label={isArabic ? 'درجة العميل' : 'Lead Score'}
                value={form.leadScore}
                onChange={(value) => updateForm('leadScore', value)}
                min={0}
                max={100}
              />

              <SelectField
                label={isArabic ? 'حرارة العميل' : 'Customer Temperature'}
                value={form.customerTemperature}
                onChange={(value) => updateForm('customerTemperature', value)}
                options={customerTemperatures.map((value) => ({
                  value,
                  label: localizedTemperature(value, isArabic),
                }))}
              />

              <TextField
                label={isArabic ? 'نطاق الميزانية' : 'Budget Range'}
                value={form.budgetRange}
                onChange={(value) => updateForm('budgetRange', value)}
              />

              <div className="md:col-span-3">
                <TextareaField
                  label={isArabic ? 'ملاحظات' : 'Notes'}
                  value={form.notes}
                  onChange={(value) => updateForm('notes', value)}
                />
              </div>
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
              : isEditing
                ? isArabic
                  ? 'حفظ التعديل'
                  : 'Save Changes'
                : isArabic
                  ? 'حفظ العميل'
                  : 'Save Client'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientDetailsModal({
  client,
  isArabic,
  onClose,
  onEdit,
}: {
  client: ClientRecord;
  isArabic: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const organizationDetails: DetailItem[] = [
    [isArabic ? 'اسم العميل / المؤسسة' : 'Client / Organization Name', getClientName(client)],
    [isArabic ? 'القطاع' : 'Industry', client.industry],
    [isArabic ? 'حجم الشركة' : 'Company Size', client.companySize],
    [isArabic ? 'الدولة' : 'Country', client.country],
    [isArabic ? 'المدينة' : 'City', client.city],
    [
      isArabic ? 'لديه موقع إلكتروني؟' : 'Has Website?',
      client.website ? (isArabic ? 'نعم' : 'Yes') : isArabic ? 'لا' : 'No',
    ],
    [isArabic ? 'رابط الموقع الإلكتروني' : 'Website Link', client.website, true],
    [isArabic ? 'هاتف الشركة' : 'Company Phone', client.companyPhone, true],
    [isArabic ? 'بريد الشركة' : 'Company Email', client.companyEmail, true],
  ];

  const contactDetails: DetailItem[] = [
    [isArabic ? 'اسم الشخص' : 'Person Name', client.primaryContactName],
    [isArabic ? 'المسمى الوظيفي' : 'Job Title', client.primaryContactJobTitle],
    [isArabic ? 'بريد الشخص' : 'Person Email', client.primaryContactEmail, true],
    [isArabic ? 'هاتف الشخص' : 'Person Phone', client.primaryContactPhone, true],
    [isArabic ? 'مصدر العميل' : 'Lead Source', client.leadSource],
    [isArabic ? 'درجة العميل' : 'Lead Score', client.leadScore],
    [isArabic ? 'حرارة العميل' : 'Customer Temperature', localizedTemperature(client.customerTemperature, isArabic)],
    [isArabic ? 'صاحب القرار' : 'Decision Maker', localizedDecisionMaker(client.decisionMaker, isArabic)],
    [isArabic ? 'نطاق الميزانية' : 'Budget Range', client.budgetRange],
    [isArabic ? 'ملاحظات' : 'Notes', client.notes],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="text-sm font-bold text-blue-600">
              {isArabic ? 'تفاصيل العميل' : 'Client Details'}
            </p>
            <h2 className="mt-1 text-2xl font-black text-gray-950">
              {getClientName(client)}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {getClientEmail(client)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600"
            >
              <Pencil className="h-4 w-4" />
              {isArabic ? 'تعديل' : 'Edit'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-112px)] space-y-5 overflow-y-auto p-6">
          <DetailsSection
            title={isArabic ? 'بيانات المؤسسة' : 'Organization Information'}
            items={organizationDetails}
          />

          <DetailsSection
            title={isArabic ? 'بيانات الشخص المسؤول' : 'Contact Person'}
            items={contactDetails}
          />

          {client.contacts && client.contacts.length > 1 && (
            <div className="rounded-3xl border border-gray-100 p-5">
              <h3 className="mb-4 font-black text-gray-950">
                {isArabic ? 'جهات اتصال إضافية' : 'Additional Contacts'}
              </h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {client.contacts.map((contact, index) => (
                  <div
                    key={`${contact.email}-${index}`}
                    className="rounded-2xl bg-gray-50 p-4"
                  >
                    <p className="font-black text-gray-900">{contact.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{contact.jobTitle}</p>
                    <p className="mt-2 text-sm font-bold text-gray-700">
                      {contact.email || '-'}
                    </p>
                    <p className="mt-1 text-sm font-bold text-gray-700">
                      {contact.phone || '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Feedback({
  tone,
  message,
  onClose,
}: {
  tone: 'blue' | 'red';
  message: string;
  onClose?: () => void;
}) {
  const styles =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';

  return (
    <div className={`rounded-2xl border px-5 py-4 font-medium ${styles}`}>
      <div className="flex items-start justify-between gap-4">
        <p>{message}</p>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="font-bold opacity-70 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ isArabic }: { isArabic: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
      <Building2 className="mx-auto h-12 w-12 text-gray-300" />

      <h3 className="mt-4 text-lg font-black text-gray-700">
        {isArabic ? 'لا يوجد عملاء بعد' : 'No clients yet'}
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        {isArabic
          ? 'اضغط إضافة عميل لإدخال أول عميل.'
          : 'Click Add Client to add the first client.'}
      </p>
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
  return (
    <th className="whitespace-nowrap px-5 py-4 text-start text-xs font-black uppercase tracking-wide">
      {label}
    </th>
  );
}

function TableCell({
  value,
  strong,
  ltr,
}: {
  value: string;
  strong?: boolean;
  ltr?: boolean;
}) {
  return (
    <td
      className={`max-w-[280px] whitespace-nowrap px-5 py-4 ${
        strong ? 'font-black text-gray-950' : 'font-medium text-gray-700'
      }`}
      title={value}
    >
      <span
        dir={ltr ? 'ltr' : undefined}
        className={`block overflow-hidden text-ellipsis ${ltr ? ltrValueClass : ''}`}
      >
        {value}
      </span>
    </td>
  );
}

function DetailsSection({
  title,
  items,
}: {
  title: string;
  items: DetailItem[];
}) {
  return (
    <div className="rounded-3xl border border-gray-100 p-5">
      <h3 className="mb-4 font-black text-gray-950">{title}</h3>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map(([label, value, ltr]) => (
          <div key={label} className="rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold text-gray-400">{label}</p>
            <p
  dir={ltr ? 'ltr' : undefined}
  className={`mt-1 break-words font-bold text-gray-900 ${ltr ? ltrValueClass : ''}`}
>
  {textOrDash(value)}
</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
          {icon}
        </div>
        <h3 className="font-black text-gray-950">{title}</h3>
      </div>

      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </label>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}