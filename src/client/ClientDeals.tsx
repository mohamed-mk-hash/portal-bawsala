import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Eye,
  Search,
  X,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type ClientApprovalStatus = 'pending' | 'approved' | 'rejected';

type DealRecord = {
  id: string;
  dealId?: string;
  recordType?: string;

  clientId?: string;
  clientName?: string;
  companyName?: string;
  clientEmail?: string;
  clientPhone?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  pipeline?: string;
  stage?: string;
  probability?: number;
  dealTitle?: string;
  dealStatus?: string;
  priority?: string;
  leadSource?: string;
  leadScore?: number;
  customerTemperature?: string;
  decisionMaker?: string;
  budgetRange?: string;
  productService?: string;
  dealValue?: number;
  currency?: string;
  expectedCloseDate?: string;
  renewalDate?: string;
  contractDuration?: string;
  paymentTerms?: string;
  activityType?: string;
  activitySubject?: string;
  activityDueDate?: string;
  activityStatus?: string;
  owner?: string;
  department?: string;
  tags?: string;
  competitor?: string;
  nextAction?: string;
  notes?: string;

  clientApprovalRequired?: boolean;
  clientApprovalStatus?: ClientApprovalStatus;
  clientApprovedAt?: Timestamp;
  clientApprovedBy?: string;
  clientRejectedAt?: Timestamp;
  clientRejectedBy?: string;
  clientRejectionReason?: string;

  dealEmailSentAt?: Timestamp;
  dealEmailSentTo?: string;
  dealEmailError?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

type DetailItem = [label: string, value: unknown, ltr?: boolean];

type AuthContextLoose = {
  user?: {
    uid?: string;
    id?: string;
    clientId?: string;
    email?: string;
  };
  currentUser?: {
    uid?: string;
    id?: string;
    clientId?: string;
    email?: string;
  };
  client?: {
    id?: string;
    clientId?: string;
    email?: string;
    companyEmail?: string;
    primaryContactEmail?: string;
  };
  clientId?: string;
  uid?: string;
  email?: string;
  role?: string;
};

const ltrValueClass =
  'inline-block text-left [direction:ltr] [unicode-bidi:plaintext]';

const textOrDash = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const normalizeEmail = (value?: string) => {
  return value?.trim().toLowerCase() || '';
};

const uniqueValues = (values: string[]) => {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const getTimestampMs = (value?: Timestamp) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return 0;
};

const formatMoney = (amount: number, currency?: string) => {
  const selectedCurrency = currency || 'DZD';

  return `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: selectedCurrency === 'DZD' ? 0 : 2,
    maximumFractionDigits: selectedCurrency === 'DZD' ? 0 : 2,
  })} ${selectedCurrency}`;
};

const getDealTitle = (deal: DealRecord) => {
  return textOrDash(deal.dealTitle || deal.productService);
};

const getDealClientName = (deal: DealRecord) => {
  return textOrDash(deal.clientName || deal.companyName);
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

const localizedApprovalStatus = (
  value: ClientApprovalStatus | string | undefined,
  isArabic: boolean
) => {
  const labels: Record<string, { ar: string; en: string }> = {
    pending: { ar: 'بانتظار موافقتك', en: 'Waiting for your approval' },
    approved: { ar: 'تمت الموافقة', en: 'Approved' },
    rejected: { ar: 'تم الرفض', en: 'Rejected' },
  };

  if (!value) return isArabic ? 'بانتظار موافقتك' : 'Waiting for your approval';
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

const getCurrentClientIds = (auth: AuthContextLoose) => {
  const localClientId =
    localStorage.getItem('clientId') ||
    localStorage.getItem('currentClientId') ||
    localStorage.getItem('bawsalaClientId') ||
    '';

  return uniqueValues([
    auth.clientId || '',
    auth.uid || '',
    auth.user?.clientId || '',
    auth.user?.id || '',
    auth.user?.uid || '',
    auth.currentUser?.clientId || '',
    auth.currentUser?.id || '',
    auth.currentUser?.uid || '',
    auth.client?.clientId || '',
    auth.client?.id || '',
    localClientId,
  ]);
};

const getCurrentClientEmails = (auth: AuthContextLoose) => {
  const localEmail =
    localStorage.getItem('clientEmail') ||
    localStorage.getItem('email') ||
    localStorage.getItem('bawsalaClientEmail') ||
    '';

  const emails = uniqueValues([
    auth.email || '',
    auth.user?.email || '',
    auth.currentUser?.email || '',
    auth.client?.email || '',
    auth.client?.companyEmail || '',
    auth.client?.primaryContactEmail || '',
    localEmail,
  ]);

  const lowerEmails = emails.map((email) => normalizeEmail(email));

  return uniqueValues([...emails, ...lowerEmails]);
};

const getActorId = (auth: AuthContextLoose) => {
  return (
    auth.user?.uid ||
    auth.currentUser?.uid ||
    auth.uid ||
    auth.clientId ||
    auth.client?.id ||
    ''
  );
};

const canClientApproveDeal = (deal: DealRecord) => {
  const approvalStatus = deal.clientApprovalStatus || 'pending';

  return (
    deal.dealStatus === 'Open' &&
    deal.clientApprovalRequired !== false &&
    approvalStatus === 'pending'
  );
};

export const ClientDeals: React.FC = () => {
  const { isArabic } = useLanguage();
  const auth = useAuth() as AuthContextLoose;

  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<DealRecord | null>(null);
  const [processingDealId, setProcessingDealId] = useState<string | null>(null);
  const [rejectDeal, setRejectDeal] = useState<DealRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const clientIds = useMemo(() => getCurrentClientIds(auth), [auth]);
  const clientEmails = useMemo(() => getCurrentClientEmails(auth), [auth]);

  const hasClientIdentifier = clientIds.length > 0 || clientEmails.length > 0;

  useEffect(() => {
    setLoading(true);
    setError('');
    setDeals([]);

    const dealQueries: Query<DocumentData>[] = [];

    clientIds.forEach((clientId) => {
      dealQueries.push(
        query(collection(db, 'deals'), where('clientId', '==', clientId))
      );
    });

    clientEmails.forEach((email) => {
      dealQueries.push(
        query(collection(db, 'deals'), where('clientEmail', '==', email))
      );

      dealQueries.push(
        query(collection(db, 'deals'), where('contactEmail', '==', email))
      );
    });

    if (dealQueries.length === 0) {
      setLoading(false);
      setError(
        isArabic
          ? 'تعذر تحديد حساب العميل الحالي. تحقق من AuthContext أو بيانات تسجيل الدخول.'
          : 'Could not identify the current client. Check AuthContext or login data.'
      );
      return;
    }

    const snapshotsByQuery = new Map<number, DealRecord[]>();
    const loadedQueries = new Set<number>();

    const emitMergedDeals = () => {
      const merged = new Map<string, DealRecord>();

      snapshotsByQuery.forEach((items) => {
        items.forEach((deal) => {
          if (deal.recordType && deal.recordType !== 'deal') return;
          merged.set(deal.id, deal);
        });
      });

      const sortedDeals = Array.from(merged.values()).sort((a, b) => {
        return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
      });

      setDeals(sortedDeals);
    };

    const unsubscribers = dealQueries.map((dealQuery, index) => {
      return onSnapshot(
        dealQuery,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as DealRecord[];

          snapshotsByQuery.set(index, data);
          loadedQueries.add(index);

          emitMergedDeals();

          if (loadedQueries.size === dealQueries.length) {
            setLoading(false);
          }
        },
        (firestoreError) => {
          console.error(firestoreError);
          setLoading(false);

          setDeals((currentDeals) => {
            if (currentDeals.length === 0) {
              setError(
                isArabic
                  ? 'تعذر تحميل صفقاتك. تحقق من صلاحيات Firestore.'
                  : 'Could not load your deals. Check Firestore permissions.'
              );
            }

            return currentDeals;
          });
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isArabic, clientIds.join('|'), clientEmails.join('|')]);

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
        deal.nextAction,
        deal.clientApprovalStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(text);
    });
  }, [deals, search]);

  const openCount = deals.filter((deal) => deal.dealStatus === 'Open').length;
  const wonCount = deals.filter((deal) => deal.dealStatus === 'Won').length;
  const pendingApprovalCount = deals.filter((deal) =>
    canClientApproveDeal(deal)
  ).length;

  const totalValueByCurrency = deals.reduce<Record<string, number>>(
    (totals, deal) => {
      const currency = deal.currency || 'DZD';
      totals[currency] = (totals[currency] || 0) + Number(deal.dealValue || 0);
      return totals;
    },
    {}
  );

  const totalValueLabel =
    Object.keys(totalValueByCurrency).length > 0
      ? Object.entries(totalValueByCurrency)
          .map(([currency, amount]) => formatMoney(amount, currency))
          .join(' / ')
      : formatMoney(0, 'DZD');

  const approveDeal = async (deal: DealRecord) => {
    try {
      setProcessingDealId(deal.id);
      setError('');
      setMessage('');

      await updateDoc(doc(db, 'deals', deal.id), {
        dealStatus: 'Won',
        clientApprovalStatus: 'approved',
        clientApprovedAt: serverTimestamp(),
        clientApprovedBy: getActorId(auth),
        updatedAt: serverTimestamp(),
      });

      setMessage(
        isArabic
          ? 'تمت الموافقة على الصفقة بنجاح. أصبحت الصفقة ناجحة.'
          : 'Deal approved successfully. The deal is now marked as won.'
      );

      setSelectedDeal(null);
    } catch (approvalError) {
      console.error(approvalError);

      setError(
        isArabic
          ? 'تعذر قبول الصفقة. تحقق من صلاحيات Firestore.'
          : 'Could not approve the deal. Check Firestore permissions.'
      );
    } finally {
      setProcessingDealId(null);
    }
  };

  const openRejectModal = (deal: DealRecord) => {
    setRejectDeal(deal);
    setRejectionReason('');
    setSelectedDeal(null);
    setError('');
    setMessage('');
  };

  const closeRejectModal = () => {
    if (processingDealId) return;
    setRejectDeal(null);
    setRejectionReason('');
  };

  const rejectCurrentDeal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rejectDeal) return;

    try {
      setProcessingDealId(rejectDeal.id);
      setError('');
      setMessage('');

      await updateDoc(doc(db, 'deals', rejectDeal.id), {
        dealStatus: 'Lost',
        clientApprovalStatus: 'rejected',
        clientRejectedAt: serverTimestamp(),
        clientRejectedBy: getActorId(auth),
        clientRejectionReason: rejectionReason.trim(),
        updatedAt: serverTimestamp(),
      });

      setMessage(
        isArabic
          ? 'تم رفض الصفقة وإرسال الحالة للإدارة.'
          : 'Deal rejected and the status was sent to admin.'
      );

      setRejectDeal(null);
      setRejectionReason('');
    } catch (rejectionError) {
      console.error(rejectionError);

      setError(
        isArabic
          ? 'تعذر رفض الصفقة. تحقق من صلاحيات Firestore.'
          : 'Could not reject the deal. Check Firestore permissions.'
      );
    } finally {
      setProcessingDealId(null);
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            <BriefcaseBusiness className="h-4 w-4" />
            {isArabic ? 'صفقاتي' : 'My Deals'}
          </div>

          <h1 className="mt-4 text-3xl font-black text-gray-950">
            {isArabic ? 'صفقاتي' : 'My Deals'}
          </h1>

          <p className="mt-2 text-gray-500">
            {isArabic
              ? 'هنا يمكنك متابعة الصفقات المرتبطة بحسابك والموافقة على الصفقات الجديدة.'
              : 'Here you can view your deals and approve newly created deals.'}
          </p>
        </div>
      </div>

      {!hasClientIdentifier && (
        <Feedback
          tone="red"
          message={
            isArabic
              ? 'لم يتم العثور على معرف العميل أو بريده داخل جلسة الدخول.'
              : 'No client ID or email was found in the login session.'
          }
        />
      )}

      {message && (
        <Feedback tone="blue" message={message} onClose={() => setMessage('')} />
      )}

      {error && (
        <Feedback tone="red" message={error} onClose={() => setError('')} />
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <StatCard
          label={isArabic ? 'إجمالي الصفقات' : 'Total Deals'}
          value={deals.length.toString()}
        />

        <StatCard
          label={isArabic ? 'بانتظار موافقتك' : 'Waiting Approval'}
          value={pendingApprovalCount.toString()}
        />

        <StatCard
          label={isArabic ? 'صفقات مفتوحة' : 'Open Deals'}
          value={openCount.toString()}
        />

        <StatCard
          label={isArabic ? 'صفقات ناجحة' : 'Won Deals'}
          value={wonCount.toString()}
        />

        <StatCard
          label={isArabic ? 'إجمالي القيمة' : 'Total Value'}
          value={totalValueLabel}
          ltr
        />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? 'جدول الصفقات' : 'Deal Table'}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'يعرض الجدول صفقاتك فقط. يمكنك قبول الصفقة أو رفضها إذا كانت بانتظار موافقتك.'
                : 'The table shows only your deals. You can approve or reject deals waiting for your approval.'}
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
              placeholder={isArabic ? 'بحث عن صفقة...' : 'Search deals...'}
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'
              }`}
            />
          </div>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الصفقات...' : 'Loading deals...'}
          </p>
        )}

        {!loading && filteredDeals.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-300" />

            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد صفقات مرتبطة بحسابك' : 'No deals linked to your account'}
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              {isArabic
                ? 'عند إنشاء صفقة لك من طرف الإدارة ستظهر هنا.'
                : 'When the admin creates a deal for you, it will appear here.'}
            </p>
          </div>
        )}

        {!loading && filteredDeals.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <TableHead label={isArabic ? 'عنوان الصفقة' : 'Deal Title'} />
                    <TableHead label={isArabic ? 'الخدمة' : 'Service'} />
                    <TableHead label={isArabic ? 'المرحلة' : 'Stage'} />
                    <TableHead label={isArabic ? 'الحالة' : 'Status'} />
                    <TableHead label={isArabic ? 'موافقتك' : 'Your Approval'} />
                    <TableHead label={isArabic ? 'القيمة' : 'Value'} />
                    <TableHead label={isArabic ? 'الإجراءات' : 'Actions'} />
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredDeals.map((deal) => {
                    const canApprove = canClientApproveDeal(deal);
                    const isProcessing = processingDealId === deal.id;

                    return (
                      <tr key={deal.id} className="transition hover:bg-blue-50/50">
                        <TableCell strong value={getDealTitle(deal)} />
                        <TableCell value={textOrDash(deal.productService)} />
                        <TableCell value={textOrDash(deal.stage)} />

                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge value={deal.dealStatus || ''} isArabic={isArabic} />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <ApprovalBadge
                            value={deal.clientApprovalStatus || 'pending'}
                            isArabic={isArabic}
                          />
                        </td>

                        <TableCell
                          ltr
                          value={formatMoney(Number(deal.dealValue || 0), deal.currency)}
                        />

                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedDeal(deal)}
                              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                            >
                              <Eye className="h-4 w-4" />
                              {isArabic ? 'التفاصيل' : 'Details'}
                            </button>

                            {canApprove && (
                              <>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => approveDeal(deal)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-black text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  <BadgeCheck className="h-4 w-4" />
                                  {isProcessing
                                    ? isArabic
                                      ? 'جاري...'
                                      : 'Processing...'
                                    : isArabic
                                      ? 'قبول'
                                      : 'Accept'}
                                </button>

                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => openRejectModal(deal)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  <X className="h-4 w-4" />
                                  {isArabic ? 'رفض' : 'Reject'}
                                </button>
                              </>
                            )}
                          </div>
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

      {selectedDeal && (
        <DealDetailsModal
          deal={selectedDeal}
          isArabic={isArabic}
          processingDealId={processingDealId}
          onClose={() => setSelectedDeal(null)}
          onApprove={approveDeal}
          onReject={openRejectModal}
        />
      )}

      {rejectDeal && (
        <RejectDealModal
          deal={rejectDeal}
          isArabic={isArabic}
          reason={rejectionReason}
          processing={processingDealId === rejectDeal.id}
          onReasonChange={setRejectionReason}
          onClose={closeRejectModal}
          onSubmit={rejectCurrentDeal}
        />
      )}
    </div>
  );
};

function DealDetailsModal({
  deal,
  isArabic,
  processingDealId,
  onClose,
  onApprove,
  onReject,
}: {
  deal: DealRecord;
  isArabic: boolean;
  processingDealId: string | null;
  onClose: () => void;
  onApprove: (deal: DealRecord) => Promise<void>;
  onReject: (deal: DealRecord) => void;
}) {
  const canApprove = canClientApproveDeal(deal);
  const isProcessing = processingDealId === deal.id;

  const dealDetails: DetailItem[] = [
    [isArabic ? 'العميل' : 'Client', getDealClientName(deal)],
    [isArabic ? 'عنوان الصفقة' : 'Deal Title', deal.dealTitle],
    ['Pipeline', deal.pipeline],
    [isArabic ? 'المرحلة' : 'Stage', deal.stage],
    [isArabic ? 'الحالة' : 'Status', localizedStatus(deal.dealStatus, isArabic)],
    [
      isArabic ? 'موافقتك' : 'Your Approval',
      localizedApprovalStatus(deal.clientApprovalStatus || 'pending', isArabic),
    ],
    [isArabic ? 'الأولوية' : 'Priority', localizedPriority(deal.priority, isArabic)],
    [isArabic ? 'نسبة الاحتمال' : 'Probability', `${Number(deal.probability || 0)}%`, true],
    [isArabic ? 'الخدمة' : 'Product / Service', deal.productService],
    [
      isArabic ? 'قيمة الصفقة' : 'Deal Value',
      formatMoney(Number(deal.dealValue || 0), deal.currency),
      true,
    ],
  ];

  const contractDetails: DetailItem[] = [
    [isArabic ? 'تاريخ الإغلاق المتوقع' : 'Expected Close Date', deal.expectedCloseDate, true],
    [isArabic ? 'تاريخ التجديد' : 'Renewal Date', deal.renewalDate, true],
    [isArabic ? 'مدة العقد' : 'Contract Duration', deal.contractDuration],
    [isArabic ? 'شروط الدفع' : 'Payment Terms', deal.paymentTerms],
    [isArabic ? 'نطاق الميزانية' : 'Budget Range', deal.budgetRange],
  ];

  const contactDetails: DetailItem[] = [
    [isArabic ? 'الشخص المسؤول' : 'Contact Name', deal.contactName],
    [isArabic ? 'البريد' : 'Email', deal.contactEmail || deal.clientEmail, true],
    [isArabic ? 'الهاتف' : 'Phone', deal.contactPhone || deal.clientPhone, true],
    [isArabic ? 'مصدر العميل' : 'Lead Source', deal.leadSource],
    [isArabic ? 'درجة العميل' : 'Lead Score', deal.leadScore, true],
    [
      isArabic ? 'حرارة العميل' : 'Customer Temperature',
      localizedTemperature(deal.customerTemperature, isArabic),
    ],
    [
      isArabic ? 'صاحب القرار' : 'Decision Maker',
      localizedDecisionMaker(deal.decisionMaker, isArabic),
    ],
  ];

  const activityDetails: DetailItem[] = [
    [isArabic ? 'نوع النشاط' : 'Activity Type', deal.activityType],
    [isArabic ? 'موضوع النشاط' : 'Activity Subject', deal.activitySubject],
    [isArabic ? 'تاريخ النشاط' : 'Activity Due Date', deal.activityDueDate, true],
    [isArabic ? 'حالة النشاط' : 'Activity Status', deal.activityStatus],
    [isArabic ? 'القسم' : 'Department', deal.department],
    [isArabic ? 'وسوم' : 'Tags', deal.tags],
    [isArabic ? 'الإجراء القادم' : 'Next Action', deal.nextAction],
    [isArabic ? 'ملاحظات' : 'Notes', deal.notes],
  ];

  const approvalDetails: DetailItem[] = [
    [
      isArabic ? 'حالة موافقة العميل' : 'Client Approval Status',
      localizedApprovalStatus(deal.clientApprovalStatus || 'pending', isArabic),
    ],
    [isArabic ? 'سبب الرفض' : 'Rejection Reason', deal.clientRejectionReason],
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
              {isArabic ? 'تفاصيل الصفقة' : 'Deal Details'}
            </p>

            <h2 className="mt-1 text-2xl font-black text-gray-950">
              {getDealTitle(deal)}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {getDealClientName(deal)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canApprove && (
              <>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onApprove(deal)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <BadgeCheck className="h-4 w-4" />
                  {isArabic ? 'قبول الصفقة' : 'Accept Deal'}
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => onReject(deal)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  {isArabic ? 'رفض الصفقة' : 'Reject Deal'}
                </button>
              </>
            )}

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
          {canApprove && (
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-blue-700">
              <p className="font-black">
                {isArabic
                  ? 'هذه الصفقة بانتظار موافقتك.'
                  : 'This deal is waiting for your approval.'}
              </p>

              <p className="mt-2 text-sm font-bold leading-7">
                {isArabic
                  ? 'عند قبول الصفقة ستتحول حالتها إلى صفقة ناجحة، وبعدها يمكن للإدارة إنشاء فاتورة لها.'
                  : 'When you accept it, the deal will become won, and admin can create an invoice for it.'}
              </p>
            </div>
          )}

          <DetailsSection
            title={isArabic ? 'بيانات الصفقة' : 'Deal Information'}
            items={dealDetails}
          />

          <DetailsSection
            title={isArabic ? 'بيانات التعاقد' : 'Contract Information'}
            items={contractDetails}
          />

          <DetailsSection
            title={isArabic ? 'بيانات التواصل' : 'Contact Information'}
            items={contactDetails}
          />

          <DetailsSection
            title={isArabic ? 'موافقة العميل' : 'Client Approval'}
            items={approvalDetails}
          />

          <DetailsSection
            title={isArabic ? 'النشاط والمتابعة' : 'Activity & Follow-up'}
            items={activityDetails}
          />
        </div>
      </div>
    </div>
  );
}

function RejectDealModal({
  deal,
  isArabic,
  reason,
  processing,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  deal: DealRecord;
  isArabic: boolean;
  reason: string;
  processing: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-red-600">
              {isArabic ? 'رفض الصفقة' : 'Reject Deal'}
            </p>

            <h2 className="mt-1 text-xl font-black text-gray-950">
              {getDealTitle(deal)}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'اكتب سبب الرفض حتى تتمكن الإدارة من مراجعته.'
                : 'Write the rejection reason so admin can review it.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="rounded-2xl bg-gray-100 p-3 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-2 block text-sm font-bold text-gray-700">
          {isArabic ? 'سبب الرفض' : 'Rejection Reason'}
        </label>

        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={4}
          required
          className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-800 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
          placeholder={
            isArabic
              ? 'مثال: السعر غير مناسب، نحتاج تعديل الخدمة، نحتاج وقت أكثر...'
              : 'Example: price is not suitable, we need service changes, we need more time...'
          }
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            disabled={processing}
            className="flex-1 rounded-2xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {processing
              ? isArabic
                ? 'جاري الحفظ...'
                : 'Saving...'
              : isArabic
                ? 'تأكيد الرفض'
                : 'Confirm Rejection'}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatusBadge({
  value,
  isArabic,
}: {
  value: string;
  isArabic: boolean;
}) {
  const styles: Record<string, string> = {
    Open: 'bg-yellow-100 text-yellow-700',
    Won: 'bg-green-100 text-green-700',
    Lost: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
        styles[value] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {localizedStatus(value, isArabic)}
    </span>
  );
}

function ApprovalBadge({
  value,
  isArabic,
}: {
  value?: ClientApprovalStatus | string;
  isArabic: boolean;
}) {
  const styles: Record<string, string> = {
    pending: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const key = value || 'pending';

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
        styles[key] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {localizedApprovalStatus(key, isArabic)}
    </span>
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

function StatCard({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <Card>
      <p className="text-sm font-bold text-gray-500">{label}</p>

      <p
        dir={ltr ? 'ltr' : undefined}
        className={`mt-2 text-2xl font-black text-gray-950 ${
          ltr ? ltrValueClass : ''
        }`}
      >
        {value}
      </p>
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
      className={`max-w-[300px] whitespace-nowrap px-5 py-4 ${
        strong ? 'font-black text-gray-950' : 'font-medium text-gray-700'
      }`}
      title={value}
    >
      <span
        dir={ltr ? 'ltr' : undefined}
        className={`block overflow-hidden text-ellipsis ${
          ltr ? ltrValueClass : ''
        }`}
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
              className={`mt-1 break-words font-bold text-gray-900 ${
                ltr ? ltrValueClass : ''
              }`}
            >
              {textOrDash(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}