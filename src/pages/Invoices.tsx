import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "firebase/firestore";
import {
  Banknote,
  Bell,
  CalendarDays,
  Eye,
  FileText,
  Mail,
  Plus,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
import { Card } from "../components/Card";
import { db } from "../firebase";
import { useLanguage } from "../i18n/LanguageContext";

type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";

type InvoiceItem = {
  title: string;
  quantity: number;
  unitPrice: number;
};

type DealRecord = {
  id: string;
  clientId?: string;
  clientName?: string;
  companyName?: string;
  clientEmail?: string;
  clientPhone?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  dealTitle?: string;
  dealStatus?: string;
  productService?: string;
  dealValue?: number;
  currency?: string;
  pipeline?: string;
  stage?: string;
  priority?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  dealDocId?: string;
  dealTitle?: string;
  productService?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  note?: string;
  emailSentAt?: Timestamp;
  emailSentTo?: string;
  emailError?: string;
  dueReminderSentAt?: Timestamp;
  dueReminderSentDate?: string;
  dueReminderSentTo?: string;
  dueReminderError?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type DetailItem = [label: string, value: unknown, ltr?: boolean];

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

const MAILER_SECRET =
  import.meta.env.VITE_MAILER_SECRET || "very_strong_secret";

const invoiceStatuses: {
  value: InvoiceStatus;
  ar: string;
  en: string;
}[] = [
  { value: "draft", ar: "مسودة", en: "Draft" },
  { value: "pending", ar: "بانتظار الدفع", en: "Pending" },
  { value: "paid", ar: "مدفوعة", en: "Paid" },
  { value: "overdue", ar: "متأخرة", en: "Overdue" },
  { value: "cancelled", ar: "ملغاة", en: "Cancelled" },
];

const ltrValueClass =
  "inline-block text-left [direction:ltr] [unicode-bidi:plaintext]";

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const formatMoney = (amount: number, currency?: string) => {
  const selectedCurrency = currency || "DZD";

  return `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: selectedCurrency === "DZD" ? 0 : 2,
    maximumFractionDigits: selectedCurrency === "DZD" ? 0 : 2,
  })} ${selectedCurrency}`;
};

const getTodayIso = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

const getDealTitle = (deal?: DealRecord) =>
  textOrDash(deal?.dealTitle || deal?.productService);

const getDealClient = (deal?: DealRecord) =>
  textOrDash(deal?.clientName || deal?.companyName);

const getDealEmail = (deal?: DealRecord) =>
  textOrDash(deal?.clientEmail || deal?.contactEmail);

const getDealPickerLabel = (deal?: DealRecord) => {
  if (!deal) return "";

  return `${getDealClient(deal)} - ${getDealTitle(deal)} - ${formatMoney(
    Number(deal.dealValue || 0),
    deal.currency,
  )}`;
};

const getInvoiceServiceTitle = (invoice: Invoice) => {
  return textOrDash(
    invoice.productService || invoice.dealTitle || invoice.items?.[0]?.title,
  );
};

const getStatusLabel = (status: InvoiceStatus, isArabic: boolean) => {
  const item = invoiceStatuses.find(
    (statusItem) => statusItem.value === status,
  );
  return isArabic ? item?.ar || status : item?.en || status;
};

const isValidEmail = (value?: string) => {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
};

const escapeHtml = (value: unknown) => {
  return textOrDash(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const sendEmail = async ({ to, subject, html }: EmailPayload) => {
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mailer-secret": MAILER_SECRET,
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!response.ok) {
    throw new Error("Email failed");
  }
};

const invoiceCreatedEmailHtml = (invoice: Invoice) => {
  const serviceTitle = getInvoiceServiceTitle(invoice);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>تم إنشاء فاتورة جديدة</title>
  </head>
  <body dir="rtl" style="margin:0; padding:0; background:#F5FAFF; font-family:Arial,Tahoma,sans-serif; color:#07111F; direction:rtl; text-align:right;">
    <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#F5FAFF; padding:40px 16px; direction:rtl; text-align:right;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px rgba(30,52,120,0.14);">
            <tr>
              <td style="background:linear-gradient(135deg,#1E3478,#07111F); padding:34px 28px; text-align:center;">
                <div style="display:inline-block; background:rgba(255,255,255,0.10); border-radius:18px; padding:12px 18px; color:#13D7C6; font-weight:800; letter-spacing:1px;">
                  BAWSALA PORTAL
                </div>
                <h1 style="margin:22px 0 0; color:#ffffff; font-size:28px; line-height:1.5;">تم إنشاء فاتورة جديدة</h1>
                <p style="margin:10px 0 0; color:rgba(255,255,255,0.72); font-size:15px; line-height:1.8;">تم إصدار فاتورة جديدة مرتبطة بالخدمة الموضحة أدناه.</p>
              </td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:32px 28px; direction:rtl; text-align:right;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.9;">مرحباً <strong>${escapeHtml(invoice.clientName)}</strong>،</p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.9; color:#475569;">نود إعلامكم بأنه تم إنشاء فاتورة جديدة في منصة بوصلة. تجدون ملخص الفاتورة أدناه:</p>
                <table dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FBFF; border:1px solid #E2E8F0; border-radius:18px; overflow:hidden; direction:rtl; text-align:right;">
                  <tr>
                    <td dir="rtl" align="right" style="padding:16px 18px; border-bottom:1px solid #E2E8F0; direction:rtl; text-align:right;"><strong>رقم الفاتورة:</strong> <span dir="ltr" style="direction:ltr; unicode-bidi:embed; display:inline-block;">${escapeHtml(invoice.invoiceNumber)}</span></td>
                  </tr>
                  <tr>
                   <td dir="rtl" align="right" style="padding:16px 18px; border-bottom:1px solid #E2E8F0; direction:rtl; text-align:right;"><strong>الخدمة / الصفقة:</strong> ${escapeHtml(serviceTitle)}</td>
                  </tr>
                  <tr>
                    <td dir="rtl" align="right" style="padding:16px 18px; border-bottom:1px solid #E2E8F0; direction:rtl; text-align:right;"><strong>الشركة:</strong> ${escapeHtml(invoice.companyName)}</td>
                  </tr>
                  <tr>
                    <td dir="rtl" align="right" style="padding:16px 18px; border-bottom:1px solid #E2E8F0; direction:rtl; text-align:right;"><strong>تاريخ الإصدار:</strong> <span dir="ltr" style="direction:ltr; unicode-bidi:embed; display:inline-block;">${escapeHtml(invoice.issueDate)}</span></td>
                  </tr>
                  <tr>
                   <td dir="rtl" align="right" style="padding:16px 18px; border-bottom:1px solid #E2E8F0; direction:rtl; text-align:right;"><strong>تاريخ الاستحقاق:</strong> <span dir="ltr" style="direction:ltr; unicode-bidi:embed; display:inline-block;">${escapeHtml(invoice.dueDate)}</span></td>
                  </tr>
                  <tr>
                    <td dir="rtl" align="right" style="padding:18px; background:#ECFEFF; color:#0F766E; font-size:20px; font-weight:900; direction:rtl; text-align:right;"><strong>المبلغ المطلوب:</strong> <span dir="ltr" style="direction:ltr; unicode-bidi:embed; display:inline-block;">${escapeHtml(formatMoney(Number(invoice.total || 0), invoice.currency))}</span></td>
                  </tr>
                </table>
                ${invoice.note ? `<div style="margin-top:22px; background:#FFF7ED; border:1px solid #FDBA74; border-radius:18px; padding:16px 18px; color:#9A3412;"><strong>ملاحظة:</strong> ${escapeHtml(invoice.note)}</div>` : ""}
                <p style="margin:28px 0 0; font-size:15px; line-height:1.9; color:#475569;">يرجى مراجعة الفاتورة وإتمام الدفع قبل تاريخ الاستحقاق.</p>
                <p style="margin:24px 0 0; font-size:15px; line-height:1.9; color:#07111F; font-weight:800;">فريق بوصلة</p>
              </td>
            </tr>
            <tr>
              <td style="background:#F8FBFF; padding:18px 28px; text-align:center; border-top:1px solid #E2E8F0;">
                <p style="margin:0; color:#94A3B8; font-size:12px; line-height:1.7;">© ${new Date().getFullYear()} Bawsala. جميع الحقوق محفوظة.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

const invoiceReminderEmailHtml = (invoice: Invoice) => {
  const serviceTitle = getInvoiceServiceTitle(invoice);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>تذكير بدفع الفاتورة</title>
  </head>
  <body style="margin:0; padding:0; background:#FFF7ED; font-family:Arial,Tahoma,sans-serif; color:#07111F;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED; padding:40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px rgba(154,52,18,0.14);">
            <tr>
              <td style="background:linear-gradient(135deg,#9A3412,#07111F); padding:34px 28px; text-align:center;">
                <div style="display:inline-block; background:rgba(255,255,255,0.12); border-radius:18px; padding:12px 18px; color:#FED7AA; font-weight:800; letter-spacing:1px;">
                  BAWSALA PORTAL
                </div>
                <h1 style="margin:22px 0 0; color:#ffffff; font-size:28px; line-height:1.5;">تذكير بدفع الفاتورة</h1>
                <p style="margin:10px 0 0; color:rgba(255,255,255,0.78); font-size:15px; line-height:1.8;">وصل تاريخ استحقاق الفاتورة ولم يتم تسجيلها كمدفوعة بعد.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.9;">مرحباً <strong>${escapeHtml(invoice.clientName)}</strong>،</p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.9; color:#475569;">هذا تذكير بأن تاريخ استحقاق الفاتورة التالية قد وصل، يرجى إتمام الدفع في أقرب وقت.</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED; border:1px solid #FDBA74; border-radius:18px; overflow:hidden;">
                  <tr>
                    <td style="padding:16px 18px; border-bottom:1px solid #FDBA74;"><strong>رقم الفاتورة:</strong> <span style="direction:ltr; unicode-bidi:plaintext;">${escapeHtml(invoice.invoiceNumber)}</span></td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px; border-bottom:1px solid #FDBA74;"><strong>الخدمة / الصفقة:</strong> ${escapeHtml(serviceTitle)}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 18px; border-bottom:1px solid #FDBA74;"><strong>تاريخ الاستحقاق:</strong> <span style="direction:ltr; unicode-bidi:plaintext;">${escapeHtml(invoice.dueDate)}</span></td>
                  </tr>
                  <tr>
                    <td style="padding:18px; background:#FFEDD5; color:#9A3412; font-size:20px; font-weight:900;"><strong>المبلغ المطلوب الآن:</strong> <span style="direction:ltr; unicode-bidi:plaintext;">${escapeHtml(formatMoney(Number(invoice.total || 0), invoice.currency))}</span></td>
                  </tr>
                </table>
                <p style="margin:28px 0 0; font-size:15px; line-height:1.9; color:#475569;">إذا تم الدفع بالفعل، يرجى تجاهل هذه الرسالة أو التواصل معنا لتحديث حالة الفاتورة.</p>
                <p style="margin:24px 0 0; font-size:15px; line-height:1.9; color:#07111F; font-weight:800;">فريق بوصلة</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

export const Invoices: React.FC = () => {
  const { isArabic } = useLanguage();

  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );

  const reminderProcessingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const dealsQuery = query(
      collection(db, "deals"),
      orderBy("createdAt", "desc"),
    );
    const invoicesQuery = query(
      collection(db, "invoices"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribeDeals = onSnapshot(
      dealsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as DealRecord[];
        setDeals(data);
      },
      (error) => {
        console.error(error);
        setMessage(
          isArabic
            ? "تعذر تحميل الصفقات للفوترة."
            : "Could not load deals for invoicing.",
        );
      },
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
            ? "تعذر تحميل الفواتير. تحقق من صلاحيات Firestore."
            : "Could not load invoices. Check Firestore permissions.",
        );
      },
    );

    return () => {
      unsubscribeDeals();
      unsubscribeInvoices();
    };
  }, [isArabic]);

  const billableDeals = useMemo(() => {
    return deals.filter(
      (deal) => deal.dealStatus === "Won" && Number(deal.dealValue || 0) > 0,
    );
  }, [deals]);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const filteredInvoices = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return invoices;

    return invoices.filter((invoice) => {
      return [
        invoice.invoiceNumber,
        invoice.clientName,
        invoice.clientEmail,
        invoice.companyName,
        invoice.dealTitle,
        invoice.productService,
        invoice.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [invoices, search]);

  const createInvoiceNotification = async ({
    invoice,
    type,
    status,
  }: {
    invoice: Invoice;
    type: "invoice_created" | "invoice_status_updated" | "invoice_due_reminder";
    status?: InvoiceStatus;
  }) => {
    const statusItem = status
      ? invoiceStatuses.find((item) => item.value === status)
      : null;

    await addDoc(collection(db, "notifications"), {
      clientId: invoice.clientId,
      type,
      titleAr:
        type === "invoice_created"
          ? "تم إنشاء فاتورة جديدة"
          : type === "invoice_due_reminder"
            ? "تذكير بدفع الفاتورة"
            : "تم تحديث حالة الفاتورة",
      titleEn:
        type === "invoice_created"
          ? "New invoice created"
          : type === "invoice_due_reminder"
            ? "Invoice payment reminder"
            : "Invoice status updated",
      messageAr:
        type === "invoice_created"
          ? `تم إنشاء فاتورة جديدة رقم ${invoice.invoiceNumber} بقيمة ${formatMoney(invoice.total || 0, invoice.currency)}.`
          : type === "invoice_due_reminder"
            ? `وصل تاريخ استحقاق الفاتورة ${invoice.invoiceNumber}. يرجى إتمام الدفع بقيمة ${formatMoney(invoice.total || 0, invoice.currency)}.`
            : `تم تحديث حالة الفاتورة ${invoice.invoiceNumber} إلى: ${statusItem?.ar || status}.`,
      messageEn:
        type === "invoice_created"
          ? `A new invoice ${invoice.invoiceNumber} was created with a total of ${formatMoney(invoice.total || 0, invoice.currency)}.`
          : type === "invoice_due_reminder"
            ? `Invoice ${invoice.invoiceNumber} is due. Please complete payment of ${formatMoney(invoice.total || 0, invoice.currency)}.`
            : `Invoice ${invoice.invoiceNumber} status was updated to: ${statusItem?.en || status}.`,
      isRead: false,
      createdAt: serverTimestamp(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    });
  };

  const updateInvoiceStatus = async (
    invoice: Invoice,
    status: InvoiceStatus,
  ) => {
    try {
      setProcessingId(invoice.id);
      setMessage("");

      await updateDoc(doc(db, "invoices", invoice.id), {
        status,
        updatedAt: serverTimestamp(),
      });

      await createInvoiceNotification({
        invoice,
        type: "invoice_status_updated",
        status,
      });

      setMessage(
        isArabic
          ? "تم تحديث حالة الفاتورة وإشعار العميل داخل المنصة."
          : "Invoice status updated and client notified inside the portal.",
      );
    } catch (error) {
      console.error(error);
      setMessage(
        isArabic
          ? "حدث خطأ أثناء تحديث حالة الفاتورة."
          : "Failed to update invoice status.",
      );
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    if (loading || invoices.length === 0) return;

    const today = getTodayIso();

    invoices.forEach((invoice) => {
      const shouldSendReminder =
        invoice.dueDate &&
        invoice.dueDate <= today &&
        invoice.status !== "paid" &&
        invoice.status !== "cancelled" &&
        !invoice.dueReminderSentAt &&
        !invoice.dueReminderSentDate &&
        isValidEmail(invoice.clientEmail) &&
        !reminderProcessingRef.current.has(invoice.id);

      if (!shouldSendReminder) return;

      reminderProcessingRef.current.add(invoice.id);

      const sendReminder = async () => {
        try {
          await sendEmail({
            to: invoice.clientEmail,
            subject: `تذكير بدفع الفاتورة ${invoice.invoiceNumber}`,
            html: invoiceReminderEmailHtml(invoice),
          });

          await updateDoc(doc(db, "invoices", invoice.id), {
            status:
              invoice.status === "paid" || invoice.status === "cancelled"
                ? invoice.status
                : "overdue",
            dueReminderSentAt: serverTimestamp(),
            dueReminderSentDate: today,
            dueReminderSentTo: invoice.clientEmail,
            dueReminderError: "",
            updatedAt: serverTimestamp(),
          });

          await createInvoiceNotification({
            invoice,
            type: "invoice_due_reminder",
          });
        } catch (error) {
          console.error("Due invoice reminder failed:", error);

          await updateDoc(doc(db, "invoices", invoice.id), {
            dueReminderError: (error as Error).message || "Email failed",
            updatedAt: serverTimestamp(),
          });
        } finally {
          reminderProcessingRef.current.delete(invoice.id);
        }
      };

      sendReminder();
    });
  }, [loading, invoices]);

  const totalInvoices = invoices.length;
  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "pending",
  ).length;
  const paidInvoices = invoices.filter(
    (invoice) => invoice.status === "paid",
  ).length;
  const overdueInvoices = invoices.filter(
    (invoice) => invoice.status === "overdue",
  ).length;

  const paidRevenueByCurrency = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce<Record<string, number>>((totals, invoice) => {
      const currency = invoice.currency || "DZD";
      totals[currency] = (totals[currency] || 0) + Number(invoice.total || 0);
      return totals;
    }, {});

  const paidRevenueLabel =
    Object.keys(paidRevenueByCurrency).length > 0
      ? Object.entries(paidRevenueByCurrency)
          .map(([currency, amount]) => formatMoney(amount, currency))
          .join(" / ")
      : formatMoney(0, "DZD");

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <ReceiptText className="h-4 w-4" />
            {isArabic ? "إدارة الفواتير" : "Invoice Management"}
          </div>

          <h1 className="mt-4 text-3xl font-black text-gray-950">
            {isArabic ? "الفواتير" : "Invoices"}
          </h1>
          <p className="mt-2 text-gray-500">
            {isArabic
              ? "يتم إنشاء الفواتير من الصفقات الناجحة فقط، ويتم إرسال بريد للعميل عند الإنشاء وتذكير عند حلول تاريخ الاستحقاق."
              : "Invoices are created from won deals only. Clients receive an email on creation and a due-date reminder."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {isArabic ? "إنشاء فاتورة" : "Create Invoice"}
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 font-medium text-blue-700">
          <div className="flex items-start justify-between gap-4">
            <p>{message}</p>
            <button
              type="button"
              onClick={() => setMessage("")}
              className="font-bold text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatsCard
          label={isArabic ? "كل الفواتير" : "All Invoices"}
          value={totalInvoices}
          tone="blue"
        />
        <StatsCard
          label={isArabic ? "بانتظار الدفع" : "Pending"}
          value={pendingInvoices}
          tone="yellow"
        />
        <StatsCard
          label={isArabic ? "متأخرة" : "Overdue"}
          value={overdueInvoices}
          tone="red"
        />
        <StatsCard
          label={isArabic ? "إيرادات مدفوعة" : "Paid Revenue"}
          value={paidRevenueLabel}
          tone="green"
        />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? "قائمة الفواتير" : "Invoice List"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? "الفواتير تظهر في جدول مختصر، ويمكن فتح التفاصيل لتغيير الحالة ورؤية كل البيانات."
                : "Invoices appear in a compact table. Open details to change status and view all data."}
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${
                isArabic ? "right-4" : "left-4"
              }`}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? "بحث..." : "Search..."}
              className={`w-full rounded-2xl border border-gray-200 py-3 outline-none focus:ring-2 focus:ring-blue-500 ${
                isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
              }`}
            />
          </div>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? "جاري تحميل الفواتير..." : "Loading invoices..."}
          </p>
        )}

        {!loading && filteredInvoices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <ReceiptText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? "لا توجد فواتير بعد" : "No invoices yet"}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {isArabic
                ? "اضغط إنشاء فاتورة لإضافة أول فاتورة من صفقة ناجحة."
                : "Click Create Invoice to add the first invoice from a won deal."}
            </p>
          </div>
        )}

        {!loading && filteredInvoices.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <TableHead
                      label={isArabic ? "رقم الفاتورة" : "Invoice #"}
                    />
                    <TableHead label={isArabic ? "العميل" : "Client"} />
                    <TableHead
                      label={isArabic ? "الخدمة / الصفقة" : "Service / Deal"}
                    />
                    <TableHead label={isArabic ? "الإجمالي" : "Total"} />
                    <TableHead
                      label={isArabic ? "تاريخ الاستحقاق" : "Due Date"}
                    />
                    <TableHead label={isArabic ? "الحالة" : "Status"} />
                    <TableHead label={isArabic ? "التفاصيل" : "Details"} />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="transition hover:bg-blue-50/50"
                    >
                      <TableCell ltr strong value={invoice.invoiceNumber} />
                      <TableCell
                        value={invoice.clientName || invoice.companyName || "-"}
                      />
                      <TableCell value={getInvoiceServiceTitle(invoice)} />
                      <TableCell
                        ltr
                        value={formatMoney(
                          Number(invoice.total || 0),
                          invoice.currency,
                        )}
                      />
                      <TableCell ltr value={invoice.dueDate || "-"} />
                      <td className="whitespace-nowrap px-5 py-4">
                        <StatusBadge
                          status={invoice.status}
                          isArabic={isArabic}
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                          {isArabic ? "التفاصيل" : "Details"}
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

      {showCreateModal && (
        <CreateInvoiceModal
          deals={billableDeals}
          isArabic={isArabic}
          onClose={() => setShowCreateModal(false)}
          onCreated={(emailSent) => {
            setShowCreateModal(false);
            setMessage(
              emailSent
                ? isArabic
                  ? "تم إنشاء الفاتورة وإرسال البريد للعميل بنجاح."
                  : "Invoice created and email sent to the client successfully."
                : isArabic
                  ? "تم إنشاء الفاتورة، لكن تعذر إرسال البريد للعميل. تحقق من mailer server."
                  : "Invoice created, but email could not be sent. Check the mailer server.",
            );
          }}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          isArabic={isArabic}
          processingId={processingId}
          onClose={() => setSelectedInvoiceId(null)}
          onUpdateStatus={updateInvoiceStatus}
        />
      )}
    </div>
  );
};

function CreateInvoiceModal({
  deals,
  isArabic,
  onClose,
  onCreated,
}: {
  deals: DealRecord[];
  isArabic: boolean;
  onClose: () => void;
  onCreated: (emailSent: boolean) => void;
}) {
  const [selectedDealId, setSelectedDealId] = useState("");
  const [dealSearch, setDealSearch] = useState("");
  const [isDealPickerOpen, setIsDealPickerOpen] = useState(false);
  const [status, setStatus] = useState<InvoiceStatus>("pending");
  const [issueDate, setIssueDate] = useState(() => getTodayIso());
  const [dueDate, setDueDate] = useState("");
  const [tax, setTax] = useState(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId);
  const currency = selectedDeal?.currency || "DZD";
  const unitPrice = Number(selectedDeal?.dealValue || 0);
  const subtotal = unitPrice;
  const total = subtotal + Number(tax || 0);

  const filteredDeals = useMemo(() => {
    const text = dealSearch.trim().toLowerCase();
    if (!text) return deals;

    return deals.filter((deal) =>
      [
        deal.clientName,
        deal.companyName,
        deal.dealTitle,
        deal.productService,
        deal.contactName,
        deal.clientEmail,
        deal.contactEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [deals, dealSearch]);

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError("");
      setLoading(true);

      if (!selectedDeal) {
        setError(
          isArabic
            ? "اختر صفقة ناجحة أولاً."
            : "Please select a won deal first.",
        );
        return;
      }

      if (selectedDeal.dealStatus !== "Won" || unitPrice <= 0) {
        setError(
          isArabic
            ? "يمكن إنشاء الفاتورة فقط من صفقة ناجحة لها قيمة."
            : "Invoices can only be created from a won deal with a value.",
        );
        return;
      }

      if (!dueDate) {
        setError(isArabic ? "حدد تاريخ الاستحقاق." : "Please set a due date.");
        return;
      }

      const clientEmail =
        selectedDeal.clientEmail || selectedDeal.contactEmail || "";

      if (!isValidEmail(clientEmail)) {
        setError(
          isArabic
            ? "لا يوجد بريد إلكتروني صحيح لهذا العميل، لذلك لا يمكن إرسال الفاتورة."
            : "This client does not have a valid email address, so the invoice cannot be emailed.",
        );
        return;
      }

      const invoiceNumber = `INV-${Date.now()}`;
      const itemTitle =
        selectedDeal.productService ||
        selectedDeal.dealTitle ||
        (isArabic ? "خدمة" : "Service");

      const invoicePayload = {
        invoiceNumber,
        clientId: selectedDeal.clientId || "",
        clientName: selectedDeal.clientName || selectedDeal.companyName || "",
        clientEmail,
        companyName: selectedDeal.companyName || selectedDeal.clientName || "",
        dealDocId: selectedDeal.id,
        dealTitle: selectedDeal.dealTitle || "",
        productService: selectedDeal.productService || "",
        items: [
          {
            title: itemTitle,
            quantity: 1,
            unitPrice,
          },
        ],
        subtotal,
        tax: Number(tax || 0),
        total,
        currency,
        status,
        issueDate,
        dueDate,
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const invoiceRef = await addDoc(
        collection(db, "invoices"),
        invoicePayload,
      );

      const invoiceForEmail: Invoice = {
        id: invoiceRef.id,
        ...invoicePayload,
      } as Invoice;

      await addDoc(collection(db, "notifications"), {
        clientId: selectedDeal.clientId || "",
        type: "invoice_created",
        titleAr: "تم إنشاء فاتورة جديدة",
        titleEn: "New invoice created",
        messageAr: `تم إنشاء فاتورة جديدة رقم ${invoiceNumber} بقيمة ${formatMoney(total, currency)}.`,
        messageEn: `A new invoice ${invoiceNumber} was created with a total of ${formatMoney(total, currency)}.`,
        isRead: false,
        createdAt: serverTimestamp(),
        invoiceId: invoiceRef.id,
        invoiceNumber,
      });

      let emailSent = false;

      try {
        await sendEmail({
          to: clientEmail,
          subject: `تم إنشاء فاتورة جديدة - ${invoiceNumber}`,
          html: invoiceCreatedEmailHtml(invoiceForEmail),
        });

        emailSent = true;

        await updateDoc(doc(db, "invoices", invoiceRef.id), {
          emailSentAt: serverTimestamp(),
          emailSentTo: clientEmail,
          emailError: "",
          updatedAt: serverTimestamp(),
        });
      } catch (emailError) {
        console.error("Invoice email failed:", emailError);

        await updateDoc(doc(db, "invoices", invoiceRef.id), {
          emailError: (emailError as Error).message || "Email failed",
          updatedAt: serverTimestamp(),
        });
      }

      onCreated(emailSent);
    } catch (error) {
      console.error(error);
      setError(
        isArabic
          ? "حدث خطأ أثناء إنشاء الفاتورة."
          : "Failed to create invoice.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
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
                {isArabic ? "فاتورة جديدة" : "New Invoice"}
              </div>
              <h2 className="text-2xl font-black text-gray-950">
                {isArabic ? "إنشاء فاتورة" : "Create Invoice"}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {isArabic
                  ? "تظهر هنا فقط الصفقات الناجحة التي تحتوي على قيمة صفقة."
                  : "Only won deals with a deal value appear here."}
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
          {deals.length === 0 && (
            <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
              <p className="font-black">
                {isArabic
                  ? "لا توجد صفقات ناجحة مؤهلة للفوترة حالياً."
                  : "No won deals are available for invoicing right now."}
              </p>
              <p className="mt-2 text-sm leading-7">
                {isArabic
                  ? "يجب أن تكون الصفقة ناجحة ولها قيمة أكبر من صفر حتى تظهر هنا."
                  : "A deal must be marked as Won and have a value greater than zero to appear here."}
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
              {isArabic ? "الخدمة / العميل" : "Service / Client"}
            </label>

            <div className="relative">
              <Search
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${
                  isArabic ? "right-4" : "left-4"
                }`}
              />
              <input
                value={dealSearch}
                onFocus={() => setIsDealPickerOpen(true)}
                onChange={(e) => {
                  setDealSearch(e.target.value);
                  setSelectedDealId("");
                  setIsDealPickerOpen(true);
                }}
                placeholder={
                  isArabic
                    ? "ابحث باسم العميل أو الصفقة ثم اختر نتيجة..."
                    : "Search by client or deal, then choose a result..."
                }
                className={`w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${
                  isArabic ? "pr-11 pl-4" : "pl-11 pr-4"
                }`}
                required
                disabled={deals.length === 0}
              />

              {isDealPickerOpen && deals.length > 0 && (
                <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
                  {filteredDeals.length === 0 ? (
                    <div className="rounded-xl px-4 py-3 text-sm font-bold text-gray-400">
                      {isArabic
                        ? "لا توجد نتائج مطابقة."
                        : "No matching results."}
                    </div>
                  ) : (
                    filteredDeals.map((deal) => {
                      const active = selectedDealId === deal.id;

                      return (
                        <button
                          key={deal.id}
                          type="button"
                          onClick={() => {
                            setSelectedDealId(deal.id);
                            setDealSearch(getDealPickerLabel(deal));
                            setIsDealPickerOpen(false);
                          }}
                          className={`w-full rounded-xl px-4 py-3 text-start text-sm transition ${
                            active
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span className="block font-black text-gray-950">
                            {getDealClient(deal)}
                          </span>
                          <span className="mt-1 block font-medium text-gray-500">
                            {getDealTitle(deal)}
                          </span>
                          <span className="mt-1 block font-black text-blue-600">
                            {formatMoney(
                              Number(deal.dealValue || 0),
                              deal.currency,
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedDeal && (
            <div className="rounded-3xl bg-gray-50 p-5">
              <p className="font-bold text-gray-900">
                {getDealClient(selectedDeal)} /{" "}
                {selectedDeal.contactName || "-"}
              </p>
              <p
                dir="ltr"
                className={`mt-1 text-sm text-gray-500 ${ltrValueClass}`}
              >
                {getDealEmail(selectedDeal)}
              </p>
              <p className="mt-3 text-sm font-bold text-blue-600">
                {isArabic
                  ? "قيمة الصفقة التي ستدخل في الفاتورة"
                  : "Deal value used in the invoice"}
                :{" "}
                <span dir="ltr" className={ltrValueClass}>
                  {formatMoney(unitPrice, currency)}
                </span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DateField
              label={isArabic ? "تاريخ الإصدار" : "Issue Date"}
              value={issueDate}
              onChange={setIssueDate}
            />
            <DateField
              label={isArabic ? "تاريخ الاستحقاق" : "Due Date"}
              value={dueDate}
              onChange={setDueDate}
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-bold text-gray-700">
              {isArabic ? "حالة الفاتورة" : "Invoice Status"}
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
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
                        : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/50"
                    }`}
                  >
                    {isArabic ? item.ar : item.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 p-5">
            <h3 className="mb-4 font-black text-gray-900">
              {isArabic ? "عنصر الفاتورة" : "Invoice Item"}
            </h3>
            <div className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-12">
              <div className="md:col-span-7">
                <input
                  value={selectedDeal ? getDealTitle(selectedDeal) : ""}
                  readOnly
                  placeholder={isArabic ? "اسم الخدمة" : "Service title"}
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="number"
                  value={1}
                  readOnly
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                />
              </div>
              <div className="md:col-span-3">
                <input
                  type="number"
                  value={unitPrice}
                  readOnly
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AmountBox
              label={isArabic ? "المجموع الجزئي" : "Subtotal"}
              value={formatMoney(subtotal, currency)}
            />
            <NumberField
              label={
                isArabic
                  ? `الضريبة / إضافات (${currency})`
                  : `Tax / Extras (${currency})`
              }
              value={tax}
              onChange={setTax}
            />
            <AmountBox
              label={isArabic ? "الإجمالي" : "Total"}
              value={formatMoney(total, currency)}
              highlighted
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-gray-700">
              {isArabic ? "ملاحظة" : "Note"}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                isArabic
                  ? "ملاحظة تظهر للعميل في الفاتورة..."
                  : "A note shown to the client on the invoice..."
              }
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-6 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {isArabic ? "إلغاء" : "Cancel"}
          </button>
          <button
            disabled={loading || deals.length === 0 || !selectedDeal}
            className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? isArabic
                ? "جاري الإنشاء..."
                : "Creating..."
              : isArabic
                ? "إنشاء الفاتورة"
                : "Create Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InvoiceDetailsModal({
  invoice,
  isArabic,
  processingId,
  onClose,
  onUpdateStatus,
}: {
  invoice: Invoice;
  isArabic: boolean;
  processingId: string | null;
  onClose: () => void;
  onUpdateStatus: (invoice: Invoice, status: InvoiceStatus) => Promise<void>;
}) {
  const details: DetailItem[] = [
    [isArabic ? "رقم الفاتورة" : "Invoice Number", invoice.invoiceNumber, true],
    [isArabic ? "العميل" : "Client", invoice.clientName],
    [isArabic ? "الشركة" : "Company", invoice.companyName],
    [isArabic ? "البريد الإلكتروني" : "Email", invoice.clientEmail, true],
    [isArabic ? "الصفقة" : "Deal", invoice.dealTitle],
    [
      isArabic ? "الخدمة" : "Service",
      invoice.productService || invoice.items?.[0]?.title,
    ],
    [
      isArabic ? "المجموع الجزئي" : "Subtotal",
      formatMoney(Number(invoice.subtotal || 0), invoice.currency),
      true,
    ],
    [
      isArabic ? "الضريبة / الإضافات" : "Tax / Extras",
      formatMoney(Number(invoice.tax || 0), invoice.currency),
      true,
    ],
    [
      isArabic ? "الإجمالي" : "Total",
      formatMoney(Number(invoice.total || 0), invoice.currency),
      true,
    ],
    [isArabic ? "العملة" : "Currency", invoice.currency || "DZD"],
    [isArabic ? "تاريخ الإصدار" : "Issue Date", invoice.issueDate, true],
    [isArabic ? "تاريخ الاستحقاق" : "Due Date", invoice.dueDate, true],
    [
      isArabic ? "حالة الفاتورة" : "Status",
      getStatusLabel(invoice.status, isArabic),
    ],
    [
      isArabic ? "تم إرسال بريد الإنشاء إلى" : "Creation email sent to",
      invoice.emailSentTo || "-",
      true,
    ],
    [
      isArabic ? "تم إرسال تذكير الاستحقاق إلى" : "Due reminder sent to",
      invoice.dueReminderSentTo || "-",
      true,
    ],
    [isArabic ? "ملاحظة" : "Note", invoice.note],
  ];

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
              <ReceiptText className="h-4 w-4" />
              {isArabic ? "تفاصيل الفاتورة" : "Invoice Details"}
            </div>
            <h2 className="text-2xl font-black text-gray-950">
              <span dir="ltr" className={ltrValueClass}>
                {invoice.invoiceNumber}
              </span>
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {invoice.companyName} / {invoice.clientName}
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

        <div className="max-h-[calc(92vh-118px)] space-y-6 overflow-y-auto p-6">
          <div>
            <label className="mb-3 block text-sm font-bold text-gray-700">
              {isArabic ? "تغيير حالة الفاتورة" : "Change Invoice Status"}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
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
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
                        : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/50"
                    }`}
                  >
                    {isArabic ? item.ar : item.en}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {details.map(([label, value, ltr]) => (
              <DetailBox
                key={label}
                label={label}
                value={textOrDash(value)}
                ltr={ltr}
              />
            ))}
          </div>

          <div className="rounded-3xl border border-gray-100 p-5">
            <h3 className="mb-4 font-black text-gray-950">
              {isArabic ? "عناصر الفاتورة" : "Invoice Items"}
            </h3>
            <div className="space-y-3">
              {(invoice.items || []).map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="grid grid-cols-1 gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-12"
                >
                  <div className="md:col-span-6">
                    <SmallInfo
                      label={isArabic ? "العنصر" : "Item"}
                      value={item.title || "-"}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <SmallInfo
                      label={isArabic ? "الكمية" : "Qty"}
                      value={String(item.quantity || 0)}
                      ltr
                    />
                  </div>
                  <div className="md:col-span-4">
                    <SmallInfo
                      label={isArabic ? "سعر الوحدة" : "Unit Price"}
                      value={formatMoney(
                        Number(item.unitPrice || 0),
                        invoice.currency,
                      )}
                      ltr
                    />
                  </div>
                </div>
              ))}
            </div>
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
  tone: "blue" | "yellow" | "green" | "red";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    yellow: "bg-yellow-50 text-yellow-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div
          className={`rounded-2xl px-3 py-2 text-xs font-black ${styles[tone]}`}
        >
          LIVE
        </div>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-950">{value}</p>
    </div>
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
        strong ? "font-black text-gray-950" : "font-medium text-gray-700"
      }`}
      title={value}
    >
      <span
        dir={ltr ? "ltr" : undefined}
        className={`block overflow-hidden text-ellipsis ${ltr ? ltrValueClass : ""}`}
      >
        {value}
      </span>
    </td>
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
    draft: "bg-gray-100 text-gray-700",
    pending: "bg-yellow-100 text-yellow-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${styles[status]}`}
    >
      {getStatusLabel(status, isArabic)}
    </span>
  );
}

function DetailBox({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p
        dir={ltr ? "ltr" : undefined}
        className={`mt-1 break-words font-bold text-gray-900 ${ltr ? ltrValueClass : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function SmallInfo({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p
        dir={ltr ? "ltr" : undefined}
        className={`mt-1 font-bold text-gray-900 ${ltr ? ltrValueClass : ""}`}
      >
        {value || "-"}
      </p>
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
        step="0.01"
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
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-gray-100 bg-gray-50 text-gray-800"
      }`}
    >
      <p className="text-sm font-bold opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
