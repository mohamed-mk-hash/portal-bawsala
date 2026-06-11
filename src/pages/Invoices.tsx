import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Banknote,
  FileText,
  Plus,
  ReceiptText,
  Search,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

type CurrentService = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  serviceNameAr: string;
  serviceNameEn: string;
  planNameAr: string;
  planNameEn: string;
  planPriceAr: string;
  planPriceEn: string;
  status?: string;
  progress?: number;
  completionApprovalStatus?: string;
};

type InvoiceItem = {
  title: string;
  quantity: number;
  unitPrice: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  serviceDocId?: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  planNameAr?: string;
  planNameEn?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  note?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const invoiceStatuses: {
  value: InvoiceStatus;
  ar: string;
  en: string;
}[] = [
  { value: 'draft', ar: 'مسودة', en: 'Draft' },
  { value: 'pending', ar: 'بانتظار الدفع', en: 'Pending' },
  { value: 'paid', ar: 'مدفوعة', en: 'Paid' },
  { value: 'overdue', ar: 'متأخرة', en: 'Overdue' },
  { value: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
];

export const Invoices: React.FC = () => {
  const { isArabic } = useLanguage();

  const [services, setServices] = useState<CurrentService[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const servicesQuery = query(collection(db, 'services'));

    const unsubscribeServices = onSnapshot(servicesQuery, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as CurrentService[];

      setServices(data);
    });

    const invoicesQuery = query(
      collection(db, 'invoices'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeInvoices = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Invoice[];

        setInvoices(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setMessage(
          isArabic
            ? 'تعذر تحميل الفواتير. تحقق من صلاحيات Firestore أو الفهارس.'
            : 'Could not load invoices. Check Firestore permissions or indexes.'
        );
      }
    );

    return () => {
      unsubscribeServices();
      unsubscribeInvoices();
    };
  }, [isArabic]);

  const billableServices = services.filter((service) => {
    return (
      service.status === 'completed' &&
      Number(service.progress || 0) === 100 &&
      service.completionApprovalStatus === 'approved'
    );
  });

  const createInvoiceNotification = async ({
    invoice,
    type,
    status,
  }: {
    invoice: Invoice;
    type: 'invoice_created' | 'invoice_status_updated';
    status?: InvoiceStatus;
  }) => {
    const statusItem = status
      ? invoiceStatuses.find((item) => item.value === status)
      : null;

    await addDoc(collection(db, 'notifications'), {
      clientId: invoice.clientId,
      type,
      titleAr:
        type === 'invoice_created'
          ? 'تم إنشاء فاتورة جديدة'
          : 'تم تحديث حالة الفاتورة',
      titleEn:
        type === 'invoice_created'
          ? 'New invoice created'
          : 'Invoice status updated',
      messageAr:
        type === 'invoice_created'
          ? `تم إنشاء فاتورة جديدة رقم ${invoice.invoiceNumber} بقيمة ${Number(
              invoice.total || 0
            ).toLocaleString()} ${invoice.currency || 'DZD'}.`
          : `تم تحديث حالة الفاتورة ${invoice.invoiceNumber} إلى: ${
              statusItem?.ar || status
            }.`,
      messageEn:
        type === 'invoice_created'
          ? `A new invoice ${invoice.invoiceNumber} was created with a total of ${Number(
              invoice.total || 0
            ).toLocaleString()} ${invoice.currency || 'DZD'}.`
          : `Invoice ${invoice.invoiceNumber} status was updated to: ${
              statusItem?.en || status
            }.`,
      isRead: false,
      createdAt: serverTimestamp(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    });
  };

  const filteredInvoices = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) return invoices;

    return invoices.filter((invoice) => {
      return (
        invoice.invoiceNumber.toLowerCase().includes(text) ||
        invoice.clientName.toLowerCase().includes(text) ||
        invoice.clientEmail.toLowerCase().includes(text) ||
        invoice.companyName.toLowerCase().includes(text)
      );
    });
  }, [invoices, search]);

  const updateInvoiceStatus = async (
    invoice: Invoice,
    status: InvoiceStatus
  ) => {
    try {
      setProcessingId(invoice.id);
      setMessage('');

      await updateDoc(doc(db, 'invoices', invoice.id), {
        status,
        updatedAt: serverTimestamp(),
      });

      await createInvoiceNotification({
        invoice,
        type: 'invoice_status_updated',
        status,
      });

      setMessage(
        isArabic
          ? 'تم تحديث حالة الفاتورة وإشعار العميل.'
          : 'Invoice status updated and client notified.'
      );
    } catch (error) {
      console.error(error);
      setMessage(
        isArabic
          ? 'حدث خطأ أثناء تحديث حالة الفاتورة.'
          : 'Failed to update invoice status.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const totalInvoices = invoices.length;
  const pendingInvoices = invoices.filter((i) => i.status === 'pending').length;
  const paidInvoices = invoices.filter((i) => i.status === 'paid').length;
  const totalRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <ReceiptText className="h-4 w-4" />
            {isArabic ? 'إدارة الفواتير' : 'Invoice Management'}
          </div>

          <h1 className="mt-4 text-3xl font-black text-gray-950">
            {isArabic ? 'الفواتير' : 'Invoices'}
          </h1>

          <p className="mt-2 text-gray-500">
            {isArabic
              ? 'يمكن إنشاء فاتورة فقط للخدمات المكتملة والتي وافق العميل على اكتمالها.'
              : 'Invoices can only be created for completed services approved by the client.'}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {isArabic ? 'إنشاء فاتورة' : 'Create Invoice'}
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 font-medium text-blue-700">
          <div className="flex items-start justify-between gap-4">
            <p>{message}</p>
            <button
              onClick={() => setMessage('')}
              className="font-bold text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatsCard
          label={isArabic ? 'كل الفواتير' : 'All Invoices'}
          value={totalInvoices}
          tone="blue"
        />
        <StatsCard
          label={isArabic ? 'بانتظار الدفع' : 'Pending'}
          value={pendingInvoices}
          tone="yellow"
        />
        <StatsCard
          label={isArabic ? 'مدفوعة' : 'Paid'}
          value={paidInvoices}
          tone="green"
        />
        <StatsCard
          label={isArabic ? 'إيرادات مدفوعة' : 'Paid Revenue'}
          value={`${totalRevenue.toLocaleString()} DZD`}
          tone="purple"
        />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? 'قائمة الفواتير' : 'Invoice List'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'كل الفواتير تظهر هنا، ويمكن تغيير حالتها في أي وقت.'
                : 'All invoices appear here, and their status can be updated anytime.'}
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? 'بحث...' : 'Search...'}
              className="w-full rounded-2xl border border-gray-200 px-11 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الفواتير...' : 'Loading invoices...'}
          </p>
        )}

        {!loading && filteredInvoices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <ReceiptText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد فواتير بعد' : 'No invoices yet'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {isArabic
                ? 'اضغط إنشاء فاتورة لإضافة أول فاتورة.'
                : 'Click Create Invoice to add the first invoice.'}
            </p>
          </div>
        )}

        {!loading && filteredInvoices.length > 0 && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                isArabic={isArabic}
                processingId={processingId}
                onUpdateStatus={updateInvoiceStatus}
              />
            ))}
          </div>
        )}
      </Card>

      {showCreateModal && (
        <CreateInvoiceModal
          services={billableServices}
          isArabic={isArabic}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            setMessage(
              isArabic
                ? 'تم إنشاء الفاتورة وإشعار العميل بنجاح.'
                : 'Invoice created and client notified successfully.'
            );
          }}
        />
      )}
    </div>
  );
};

function CreateInvoiceModal({
  services,
  isArabic,
  onClose,
  onCreated,
}: {
  services: CurrentService[];
  isArabic: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id || ''
  );

  const selectedService = services.find(
    (service) => service.id === selectedServiceId
  );

  const [status, setStatus] = useState<InvoiceStatus>('pending');
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState('');
  const [tax, setTax] = useState(0);
  const [note, setNote] = useState('');

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      title: selectedService
        ? isArabic
          ? selectedService.serviceNameAr
          : selectedService.serviceNameEn
        : '',
      quantity: 1,
      unitPrice: 0,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selectedService) return;

    setItems([
      {
        title: isArabic
          ? selectedService.serviceNameAr
          : selectedService.serviceNameEn,
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  }, [selectedService, isArabic]);

  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
  }, 0);

  const total = subtotal + Number(tax || 0);

  const updateItem = (
    index: number,
    key: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        title: '',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);

      if (!selectedService) {
        setError(
          isArabic
            ? 'لا توجد خدمة مؤهلة للفوترة. يجب أن تكون الخدمة مكتملة والعميل وافق على اكتمالها.'
            : 'No billable service available. The service must be completed and approved by the client.'
        );
        return;
      }

      if (!dueDate) {
        setError(
          isArabic ? 'حدد تاريخ الاستحقاق.' : 'Please set a due date.'
        );
        return;
      }

      if (items.length === 0 || subtotal <= 0) {
        setError(
          isArabic
            ? 'أضف عناصر للفاتورة وقيمة صحيحة.'
            : 'Add invoice items with a valid amount.'
        );
        return;
      }

      const invoiceNumber = `INV-${Date.now()}`;

      const invoicePayload = {
        invoiceNumber,
        clientId: selectedService.clientId,
        clientName: selectedService.clientName,
        clientEmail: selectedService.clientEmail,
        companyName: selectedService.companyName,
        serviceDocId: selectedService.id,
        serviceNameAr: selectedService.serviceNameAr,
        serviceNameEn: selectedService.serviceNameEn,
        planNameAr: selectedService.planNameAr,
        planNameEn: selectedService.planNameEn,
        items,
        subtotal,
        tax: Number(tax || 0),
        total,
        currency: 'DZD',
        status,
        issueDate,
        dueDate,
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const invoiceRef = await addDoc(collection(db, 'invoices'), invoicePayload);

      await addDoc(collection(db, 'notifications'), {
        clientId: selectedService.clientId,
        type: 'invoice_created',
        titleAr: 'تم إنشاء فاتورة جديدة',
        titleEn: 'New invoice created',
        messageAr: `تم إنشاء فاتورة جديدة رقم ${invoiceNumber} بقيمة ${total.toLocaleString()} DZD.`,
        messageEn: `A new invoice ${invoiceNumber} was created with a total of ${total.toLocaleString()} DZD.`,
        isRead: false,
        createdAt: serverTimestamp(),
        invoiceId: invoiceRef.id,
        invoiceNumber,
      });

      onCreated();
    } catch (error) {
      console.error(error);
      setError(
        isArabic
          ? 'حدث خطأ أثناء إنشاء الفاتورة.'
          : 'Failed to create invoice.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <form
        onSubmit={createInvoice}
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                <ReceiptText className="h-4 w-4" />
                {isArabic ? 'فاتورة جديدة' : 'New Invoice'}
              </div>

              <h2 className="text-2xl font-black text-gray-950">
                {isArabic ? 'إنشاء فاتورة' : 'Create Invoice'}
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                {isArabic
                  ? 'تظهر هنا فقط الخدمات المكتملة التي وافق العميل على اكتمالها.'
                  : 'Only completed services approved by the client appear here.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {services.length === 0 && (
            <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
              <p className="font-black">
                {isArabic
                  ? 'لا توجد خدمات مؤهلة للفوترة حالياً.'
                  : 'No billable services are available right now.'}
              </p>
              <p className="mt-2 text-sm leading-7">
                {isArabic
                  ? 'يجب أولاً أن تكون الخدمة مكتملة بنسبة 100%، ثم يوافق العميل على أنها انتهت.'
                  : 'The service must be completed at 100%, then the client must approve that it is finished.'}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              {isArabic ? 'الخدمة / العميل' : 'Service / Client'}
            </label>

            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
              disabled={services.length === 0}
            >
              <option value="">
                {isArabic ? 'اختر خدمة مؤهلة للفوترة' : 'Select a billable service'}
              </option>

              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.companyName} —{' '}
                  {isArabic ? service.serviceNameAr : service.serviceNameEn} —{' '}
                  {isArabic ? service.planNameAr : service.planNameEn}
                </option>
              ))}
            </select>
          </div>

          {selectedService && (
            <div className="rounded-3xl bg-gray-50 p-5">
              <p className="font-bold text-gray-900">
                {selectedService.companyName} / {selectedService.clientName}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {selectedService.clientEmail}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DateField
              label={isArabic ? 'تاريخ الإصدار' : 'Issue Date'}
              value={issueDate}
              onChange={setIssueDate}
            />

            <DateField
              label={isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}
              value={dueDate}
              onChange={setDueDate}
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-bold text-gray-700">
              {isArabic ? 'حالة الفاتورة' : 'Invoice Status'}
            </label>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {invoiceStatuses.map((item) => {
                const active = status === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatus(item.value)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                      active
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/50'
                    }`}
                  >
                    {isArabic ? item.ar : item.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-black text-gray-900">
                {isArabic ? 'عناصر الفاتورة' : 'Invoice Items'}
              </h3>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                {isArabic ? 'إضافة عنصر' : 'Add Item'}
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-12"
                >
                  <div className="md:col-span-6">
                    <input
                      value={item.title}
                      onChange={(e) =>
                        updateItem(index, 'title', e.target.value)
                      }
                      placeholder={isArabic ? 'اسم العنصر' : 'Item title'}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, 'quantity', Number(e.target.value))
                      }
                      placeholder={isArabic ? 'الكمية' : 'Qty'}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-3">
                    <input
                      type="number"
                      min={0}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, 'unitPrice', Number(e.target.value))
                      }
                      placeholder={isArabic ? 'السعر' : 'Unit price'}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="h-full w-full rounded-xl bg-red-50 font-bold text-red-600 hover:bg-red-100 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AmountBox
              label={isArabic ? 'المجموع الجزئي' : 'Subtotal'}
              value={`${subtotal.toLocaleString()} DZD`}
            />

            <NumberField
              label={isArabic ? 'الضريبة / إضافات' : 'Tax / Extras'}
              value={tax}
              onChange={setTax}
            />

            <AmountBox
              label={isArabic ? 'الإجمالي' : 'Total'}
              value={`${total.toLocaleString()} DZD`}
              highlighted
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              {isArabic ? 'ملاحظة' : 'Note'}
            </label>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                isArabic
                  ? 'ملاحظة تظهر للعميل في الفاتورة...'
                  : 'A note shown to the client on the invoice...'
              }
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-6 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            disabled={loading || services.length === 0}
            className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? isArabic
                ? 'جاري الإنشاء...'
                : 'Creating...'
              : isArabic
              ? 'إنشاء الفاتورة'
              : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InvoiceCard({
  invoice,
  isArabic,
  processingId,
  onUpdateStatus,
}: {
  invoice: Invoice;
  isArabic: boolean;
  processingId: string | null;
  onUpdateStatus: (invoice: Invoice, status: InvoiceStatus) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/60">
              {isArabic ? 'فاتورة' : 'Invoice'}
            </p>
            <h3 className="mt-2 text-2xl font-black">
              {invoice.invoiceNumber}
            </h3>
            <p className="mt-2 text-sm text-white/70">
              {invoice.companyName} / {invoice.clientName}
            </p>
          </div>

          <StatusBadge status={invoice.status} isArabic={isArabic} />
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoItem
            icon={<FileText className="h-5 w-5" />}
            label={isArabic ? 'الخدمة' : 'Service'}
            value={isArabic ? invoice.serviceNameAr || '-' : invoice.serviceNameEn || '-'}
          />

          <InfoItem
            icon={<Banknote className="h-5 w-5" />}
            label={isArabic ? 'الإجمالي' : 'Total'}
            value={`${Number(invoice.total || 0).toLocaleString()} ${invoice.currency || 'DZD'}`}
          />
        </div>

        <div className="rounded-3xl bg-gray-50 p-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <SmallInfo
              label={isArabic ? 'تاريخ الإصدار' : 'Issue Date'}
              value={invoice.issueDate}
            />
            <SmallInfo
              label={isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}
              value={invoice.dueDate}
            />
            <SmallInfo
              label={isArabic ? 'الباقة' : 'Plan'}
              value={isArabic ? invoice.planNameAr || '-' : invoice.planNameEn || '-'}
            />
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-gray-700">
            {isArabic ? 'حالة الفاتورة' : 'Invoice Status'}
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {invoiceStatuses.map((item) => {
              const active = invoice.status === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={processingId === invoice.id}
                  onClick={() => onUpdateStatus(invoice, item.value)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/50'
                  }`}
                >
                  {isArabic ? item.ar : item.en}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'blue' | 'yellow' | 'green' | 'purple';
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`rounded-2xl px-3 py-2 text-xs font-black ${styles[tone]}`}>
          LIVE
        </div>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-950">{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
  isArabic,
}: {
  status: InvoiceStatus;
  isArabic: boolean;
}) {
  const styles: Record<InvoiceStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-700',
  };

  const item = invoiceStatuses.find((statusItem) => statusItem.value === status);

  return (
    <span className={`rounded-full px-4 py-2 text-xs font-black ${styles[status]}`}>
      {isArabic ? item?.ar : item?.en}
    </span>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4">
      <div className="rounded-xl bg-blue-50 p-2 text-blue-600">{icon}</div>
      <div>
        <p className="text-xs font-bold text-gray-400">{label}</p>
        <p className="mt-1 font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p className="mt-1 font-bold text-gray-900">{value || '-'}</p>
    </div>
  );
}

function DateField({
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

      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        required
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-gray-700">
        {label}
      </label>

      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function AmountBox({
  label,
  value,
  highlighted,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlighted
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-gray-100 bg-gray-50 text-gray-800'
      }`}
    >
      <p className="text-sm font-bold opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}