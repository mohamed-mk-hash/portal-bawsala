import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  Banknote,
  CalendarDays,
  Printer,
  ReceiptText,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

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

const invoiceStatuses: Record<
  InvoiceStatus,
  { ar: string; en: string; className: string }
> = {
  draft: {
    ar: 'مسودة',
    en: 'Draft',
    className: 'bg-gray-100 text-gray-700',
  },
  pending: {
    ar: 'بانتظار الدفع',
    en: 'Pending',
    className: 'bg-yellow-100 text-yellow-700',
  },
  paid: {
    ar: 'مدفوعة',
    en: 'Paid',
    className: 'bg-green-100 text-green-700',
  },
  overdue: {
    ar: 'متأخرة',
    en: 'Overdue',
    className: 'bg-red-100 text-red-700',
  },
  cancelled: {
    ar: 'ملغاة',
    en: 'Cancelled',
    className: 'bg-slate-100 text-slate-700',
  },
};

export const ClientInvoices: React.FC = () => {
  const { user } = useAuth();
  const { isArabic } = useLanguage();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'invoices'),
      where('clientId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Invoice[];

        const sorted = data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setInvoices(sorted);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setError(
          isArabic
            ? 'تعذر تحميل الفواتير. تحقق من صلاحيات Firestore.'
            : 'Could not load invoices. Check Firestore permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [user, isArabic]);

  const totalCount = invoices.length;
  const pendingCount = invoices.filter((i) => i.status === 'pending').length;
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const unpaidTotal = invoices
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <ReceiptText className="h-4 w-4" />
          {isArabic ? 'بوابة العميل' : 'Client Portal'}
        </div>

        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'فواتيري' : 'My Invoices'}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'تابع فواتيرك، حالتها، وقم بطباعتها عند الحاجة.'
            : 'Track your invoices, status, and print them when needed.'}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatsCard
          label={isArabic ? 'كل الفواتير' : 'All Invoices'}
          value={totalCount}
          tone="blue"
        />
        <StatsCard
          label={isArabic ? 'بانتظار الدفع' : 'Pending'}
          value={pendingCount}
          tone="yellow"
        />
        <StatsCard
          label={isArabic ? 'مدفوعة' : 'Paid'}
          value={paidCount}
          tone="green"
        />
        <StatsCard
          label={isArabic ? 'غير مدفوع' : 'Unpaid Total'}
          value={`${unpaidTotal.toLocaleString()} DZD`}
          tone="red"
        />
      </div>

      <Card>
        <div className="mb-6">
          <h2 className="text-xl font-black text-gray-950">
            {isArabic ? 'قائمة الفواتير' : 'Invoice List'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isArabic
              ? 'كل فاتورة أنشأتها الإدارة ستظهر هنا.'
              : 'Every invoice created by the admin will appear here.'}
          </p>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الفواتير...' : 'Loading invoices...'}
          </p>
        )}

        {!loading && invoices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <ReceiptText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد فواتير بعد' : 'No invoices yet'}
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">
              {isArabic
                ? 'عندما تنشئ الإدارة فاتورة لك، ستظهر هنا ويمكنك طباعتها.'
                : 'When the admin creates an invoice for you, it will appear here and you can print it.'}
            </p>
          </div>
        )}

        {!loading && invoices.length > 0 && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {invoices.map((invoice) => (
              <ClientInvoiceCard
                key={invoice.id}
                invoice={invoice}
                isArabic={isArabic}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

function ClientInvoiceCard({
  invoice,
  isArabic,
}: {
  invoice: Invoice;
  isArabic: boolean;
}) {
  const printInvoice = () => {
    const printWindow = window.open('', '_blank');

    if (!printWindow) return;

    const status = invoiceStatuses[invoice.status];
    const logoUrl = '/bawsala-logo.png';

    const itemsHtml = invoice.items
      .map((item) => {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);

        return `
          <tr>
            <td>${item.title}</td>
            <td>${item.quantity}</td>
            <td>${Number(item.unitPrice).toLocaleString()} ${invoice.currency}</td>
            <td class="amount">${lineTotal.toLocaleString()} ${invoice.currency}</td>
          </tr>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${isArabic ? 'ar' : 'en'}" dir="${isArabic ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="UTF-8" />
          <title>${invoice.invoiceNumber}</title>

          <style>
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            @page {
              size: A4;
              margin: 12mm;
            }

            body {
              margin: 0;
              background: #eef4fb;
              color: #0f172a;
              font-family: Arial, Tahoma, sans-serif;
              line-height: 1.6;
            }

            .page {
              width: 100%;
              max-width: 900px;
              margin: 24px auto;
              background: #ffffff;
              border-radius: 28px;
              overflow: hidden;
              box-shadow: 0 30px 80px rgba(15, 23, 42, 0.14);
              border: 1px solid #dbe4f0;
            }

            .hero {
              background: linear-gradient(135deg, #07111f, #1e3478);
              color: white;
              padding: 36px 42px;
            }

            .hero-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 24px;
            }

            .brand {
              display: flex;
              align-items: center;
              gap: 14px;
            }

            .brand img {
              width: 64px;
              height: 64px;
              object-fit: contain;
              background: white;
              border-radius: 18px;
              padding: 8px;
            }

            .brand-name {
              font-size: 32px;
              font-weight: 900;
              letter-spacing: 0.3px;
            }

            .brand-sub {
              color: rgba(255, 255, 255, 0.75);
              font-size: 13px;
              margin-top: 2px;
            }

            .invoice-title {
              text-align: ${isArabic ? 'left' : 'right'};
            }

            .invoice-title .label {
              color: rgba(255, 255, 255, 0.75);
              font-size: 14px;
              font-weight: 700;
            }

            .invoice-title .number {
              margin-top: 4px;
              font-size: 30px;
              font-weight: 900;
            }

            .status {
              display: inline-block;
              margin-top: 12px;
              padding: 8px 16px;
              border-radius: 999px;
              background: rgba(255, 255, 255, 0.14);
              border: 1px solid rgba(255, 255, 255, 0.18);
              font-size: 13px;
              font-weight: 900;
            }

            .content {
              padding: 36px 42px 42px;
            }

            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 18px;
              margin-bottom: 24px;
            }

            .box {
              border: 1px solid #dbe4f0;
              border-radius: 22px;
              padding: 20px;
              background: #ffffff;
            }

            .box-soft {
              background: #f8fafc;
            }

            .box-title {
              font-size: 13px;
              color: #64748b;
              font-weight: 900;
              margin-bottom: 10px;
            }

            .main-text {
              font-size: 17px;
              font-weight: 900;
              color: #0f172a;
            }

            .muted {
              color: #64748b;
              font-size: 13px;
              margin-top: 4px;
            }

            .dates {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 14px;
              margin-bottom: 26px;
            }

            table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              overflow: hidden;
              border-radius: 22px;
              border: 1px solid #dbe4f0;
            }

            thead {
              background: #f8fafc;
            }

            th {
              color: #64748b;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              padding: 16px;
              text-align: ${isArabic ? 'right' : 'left'};
              border-bottom: 1px solid #dbe4f0;
            }

            td {
              padding: 18px 16px;
              border-bottom: 1px solid #e2e8f0;
              font-weight: 700;
            }

            tr:last-child td {
              border-bottom: 0;
            }

            .amount {
              color: #1d4ed8;
              font-weight: 900;
            }

            .summary {
              margin-top: 28px;
              display: flex;
              justify-content: ${isArabic ? 'flex-start' : 'flex-end'};
            }

            .summary-card {
              width: 340px;
              border-radius: 24px;
              background: #f8fafc;
              border: 1px solid #dbe4f0;
              padding: 20px;
            }

            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              color: #475569;
              font-weight: 700;
            }

            .summary-total {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
              padding-top: 18px;
              border-top: 2px solid #bfdbfe;
              font-size: 24px;
              color: #1d4ed8;
              font-weight: 900;
            }

            .note {
              margin-top: 28px;
              border-radius: 22px;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              padding: 18px 20px;
              color: #1e3a8a;
              font-weight: 700;
            }

            .footer {
              margin-top: 34px;
              padding-top: 22px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              gap: 20px;
              color: #64748b;
              font-size: 12px;
            }

            .print-actions {
              text-align: center;
              margin: 24px auto 40px;
            }

            .print-button {
              border: 0;
              background: #2563eb;
              color: white;
              padding: 14px 28px;
              border-radius: 16px;
              font-weight: 900;
              font-size: 15px;
              cursor: pointer;
            }

            @media print {
              html, body {
                background: white;
              }

              .page {
                margin: 0;
                max-width: none;
                border-radius: 20px;
                box-shadow: none;
              }

              .print-actions {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="page">
            <div class="hero">
              <div class="hero-top">
                <div class="brand">
                  <img src="${logoUrl}" alt="Bawsala Logo" />
                  <div>
                    <div class="brand-name">Bawsala</div>
                    <div class="brand-sub">Digital Services & Business Solutions</div>
                  </div>
                </div>

                <div class="invoice-title">
                  <div class="label">${isArabic ? 'فاتورة' : 'Invoice'}</div>
                  <div class="number">${invoice.invoiceNumber}</div>
                  <div class="status">${isArabic ? status.ar : status.en}</div>
                </div>
              </div>
            </div>

            <div class="content">
              <div class="grid">
                <div class="box">
                  <div class="box-title">${isArabic ? 'معلومات العميل' : 'Client Information'}</div>
                  <div class="main-text">${invoice.companyName}</div>
                  <div class="muted">${invoice.clientName}</div>
                  <div class="muted">${invoice.clientEmail}</div>
                </div>

                <div class="box box-soft">
                  <div class="box-title">${isArabic ? 'الخدمة' : 'Service'}</div>
                  <div class="main-text">${
                    isArabic
                      ? invoice.serviceNameAr || '-'
                      : invoice.serviceNameEn || '-'
                  }</div>
                  <div class="muted">${
                    isArabic
                      ? invoice.planNameAr || '-'
                      : invoice.planNameEn || '-'
                  }</div>
                </div>
              </div>

              <div class="dates">
                <div class="box box-soft">
                  <div class="box-title">${isArabic ? 'تاريخ الإصدار' : 'Issue Date'}</div>
                  <div class="main-text">${invoice.issueDate}</div>
                </div>

                <div class="box box-soft">
                  <div class="box-title">${isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}</div>
                  <div class="main-text">${invoice.dueDate}</div>
                </div>

                <div class="box box-soft">
                  <div class="box-title">${isArabic ? 'العملة' : 'Currency'}</div>
                  <div class="main-text">${invoice.currency || 'DZD'}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>${isArabic ? 'العنصر' : 'Item'}</th>
                    <th>${isArabic ? 'الكمية' : 'Qty'}</th>
                    <th>${isArabic ? 'سعر الوحدة' : 'Unit Price'}</th>
                    <th>${isArabic ? 'المجموع' : 'Total'}</th>
                  </tr>
                </thead>

                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div class="summary">
                <div class="summary-card">
                  <div class="summary-row">
                    <span>${isArabic ? 'المجموع الجزئي' : 'Subtotal'}</span>
                    <span>${Number(invoice.subtotal || 0).toLocaleString()} ${invoice.currency}</span>
                  </div>

                  <div class="summary-row">
                    <span>${isArabic ? 'الضريبة / إضافات' : 'Tax / Extras'}</span>
                    <span>${Number(invoice.tax || 0).toLocaleString()} ${invoice.currency}</span>
                  </div>

                  <div class="summary-total">
                    <span>${isArabic ? 'الإجمالي' : 'Total'}</span>
                    <span>${Number(invoice.total || 0).toLocaleString()} ${invoice.currency}</span>
                  </div>
                </div>
              </div>

              ${
                invoice.note
                  ? `<div class="note">
                      <strong>${isArabic ? 'ملاحظة:' : 'Note:'}</strong>
                      ${invoice.note}
                    </div>`
                  : ''
              }

              <div class="footer">
                <div>© ${new Date().getFullYear()} Bawsala. All rights reserved.</div>
                <div>${
                  isArabic
                    ? 'تم إنشاء هذه الفاتورة عبر منصة بوصلة.'
                    : 'This invoice was generated through Bawsala Portal.'
                }</div>
              </div>
            </div>
          </div>

          <div class="print-actions">
            <button class="print-button" onclick="window.print()">
              ${isArabic ? 'طباعة الفاتورة' : 'Print Invoice'}
            </button>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const status = invoiceStatuses[invoice.status];

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
              {isArabic ? invoice.serviceNameAr || '-' : invoice.serviceNameEn || '-'}
            </p>
          </div>

          <span className={`rounded-full px-4 py-2 text-xs font-black ${status.className}`}>
            {isArabic ? status.ar : status.en}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoItem
            icon={<Banknote className="h-5 w-5" />}
            label={isArabic ? 'الإجمالي' : 'Total'}
            value={`${Number(invoice.total || 0).toLocaleString()} ${invoice.currency}`}
          />

          <InfoItem
            icon={<CalendarDays className="h-5 w-5" />}
            label={isArabic ? 'تاريخ الاستحقاق' : 'Due Date'}
            value={invoice.dueDate}
          />
        </div>

        <div className="rounded-3xl bg-gray-50 p-5">
          <p className="text-sm font-bold text-gray-500">
            {isArabic ? 'عناصر الفاتورة' : 'Invoice Items'}
          </p>

          <div className="mt-4 space-y-3">
            {invoice.items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-2xl bg-white p-4"
              >
                <div>
                  <p className="font-bold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">
                    {item.quantity} × {Number(item.unitPrice).toLocaleString()} {invoice.currency}
                  </p>
                </div>

                <p className="font-black text-blue-600">
                  {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString()} {invoice.currency}
                </p>
              </div>
            ))}
          </div>
        </div>

        {invoice.note && (
          <div className="rounded-3xl border border-gray-100 p-5">
            <p className="text-sm font-bold text-gray-500">
              {isArabic ? 'ملاحظة' : 'Note'}
            </p>
            <p className="mt-2 leading-7 text-gray-600">{invoice.note}</p>
          </div>
        )}

        <button
          onClick={printInvoice}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
        >
          <Printer className="h-5 w-5" />
          {isArabic ? 'طباعة الفاتورة' : 'Print Invoice'}
        </button>
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
  tone: 'blue' | 'yellow' | 'green' | 'red';
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
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