import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle,
  Clock3,
  Hourglass,
  PauseCircle,
  RefreshCcw,
  X,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'completed'
  | 'paused';

type CompletionApprovalStatus = 'none' | 'pending' | 'approved' | 'refused';

type ClientService = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  companyName: string;

  serviceRequestId?: string;

  serviceId: string;
  serviceNameAr: string;
  serviceNameEn: string;

  planId: string;
  planNameAr: string;
  planNameEn: string;

  planPriceAr: string;
  planPriceEn: string;

  status?: ServiceStatus;
  progress?: number;
  teamNote?: string;
  adminNote?: string;

  completionApprovalStatus?: CompletionApprovalStatus;
  completionRefusalReason?: string;
  completionRefusalNote?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const refusalReasons = [
  {
    value: 'work_not_completed',
    ar: 'الخدمة لم تكتمل بعد',
    en: 'The service is not completed yet',
  },
  {
    value: 'needs_modifications',
    ar: 'الخدمة تحتاج تعديلات',
    en: 'The service needs modifications',
  },
  {
    value: 'missing_deliverables',
    ar: 'هناك مخرجات ناقصة',
    en: 'Some deliverables are missing',
  },
  {
    value: 'quality_issue',
    ar: 'الجودة غير مناسبة',
    en: 'Quality is not acceptable',
  },
  {
    value: 'other',
    ar: 'سبب آخر',
    en: 'Other reason',
  },
];

const statusConfig: Record<
  ServiceStatus,
  {
    ar: string;
    en: string;
    icon: React.ElementType;
    badgeClass: string;
    iconClass: string;
    progressClass: string;
  }
> = {
  not_started: {
    ar: 'لم تبدأ',
    en: 'Not Started',
    icon: Clock3,
    badgeClass: 'bg-gray-100 text-gray-700',
    iconClass: 'bg-gray-100 text-gray-700',
    progressClass: 'bg-gray-500',
  },
  in_progress: {
    ar: 'قيد العمل',
    en: 'In Progress',
    icon: RefreshCcw,
    badgeClass: 'bg-blue-100 text-blue-700',
    iconClass: 'bg-blue-100 text-blue-700',
    progressClass: 'bg-blue-600',
  },
  waiting_client: {
    ar: 'بانتظار العميل',
    en: 'Waiting for Client',
    icon: Hourglass,
    badgeClass: 'bg-yellow-100 text-yellow-700',
    iconClass: 'bg-yellow-100 text-yellow-700',
    progressClass: 'bg-yellow-500',
  },
  completed: {
    ar: 'مكتملة',
    en: 'Completed',
    icon: CheckCircle,
    badgeClass: 'bg-green-100 text-green-700',
    iconClass: 'bg-green-100 text-green-700',
    progressClass: 'bg-green-600',
  },
  paused: {
    ar: 'متوقفة مؤقتاً',
    en: 'Paused',
    icon: PauseCircle,
    badgeClass: 'bg-red-100 text-red-700',
    iconClass: 'bg-red-100 text-red-700',
    progressClass: 'bg-red-500',
  },
};

export const ClientServices: React.FC = () => {
  const { user } = useAuth();
  const { isArabic } = useLanguage();

  const [services, setServices] = useState<ClientService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const q = query(
      collection(db, 'services'),
      where('clientId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ClientService[];

        const sortedData = data.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setServices(sortedData);
        setLoading(false);
      },
      (error) => {
        console.error('Client services error:', error);
        setLoading(false);
        setError(
          isArabic
            ? 'تعذر تحميل خدماتك. تحقق من صلاحيات Firestore.'
            : 'Could not load your services. Check Firestore permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [user, isArabic]);

  const totalCount = services.length;
  const inProgressCount = services.filter(
    (service) => getServiceStatus(service) === 'in_progress'
  ).length;
  const waitingCount = services.filter(
    (service) => getServiceStatus(service) === 'waiting_client'
  ).length;
  const completedCount = services.filter(
    (service) => getServiceStatus(service) === 'completed'
  ).length;

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <BriefcaseBusiness className="h-4 w-4" />
          {isArabic ? 'بوابة العميل' : 'Client Portal'}
        </div>

        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'خدماتي' : 'My Services'}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'تابع الخدمات المقبولة، حالة كل خدمة، ونسبة تقدمها.'
            : 'Track your accepted services, their status, and progress.'}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-medium text-red-700">
          <div className="flex items-start justify-between gap-4">
            <p>{error}</p>
            <button
              onClick={() => setError('')}
              className="font-bold text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatsCard
          label={isArabic ? 'كل الخدمات' : 'All Services'}
          value={totalCount}
          tone="blue"
        />
        <StatsCard
          label={isArabic ? 'قيد العمل' : 'In Progress'}
          value={inProgressCount}
          tone="green"
        />
        <StatsCard
          label={isArabic ? 'بانتظارك' : 'Waiting for You'}
          value={waitingCount}
          tone="yellow"
        />
        <StatsCard
          label={isArabic ? 'مكتملة' : 'Completed'}
          value={completedCount}
          tone="purple"
        />
      </div>

      <Card>
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? 'الخدمات الحالية' : 'Current Services'}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'الخدمات تظهر كبطاقات مختصرة. عند انتهاء الخدمة اضغط مراجعة الاكتمال.'
                : 'Services are shown as clean compact cards. When completed, click Review completion.'}
            </p>
          </div>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الخدمات...' : 'Loading services...'}
          </p>
        )}

        {!loading && services.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-300" />

            <h3 className="mt-4 text-lg font-black text-gray-700">
              {isArabic ? 'لا توجد خدمات مقبولة بعد' : 'No accepted services yet'}
            </h3>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">
              {isArabic
                ? 'عندما تقبل الإدارة أحد طلباتك، ستظهر الخدمة هنا مع حالتها ونسبة تقدمها.'
                : 'When the admin accepts one of your requests, the service will appear here with its status and progress rate.'}
            </p>
          </div>
        )}

        {!loading && services.length > 0 && (
          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isArabic={isArabic}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

function getServiceStatus(service: ClientService): ServiceStatus {
  return service.status || 'not_started';
}

function ServiceCard({
  service,
  isArabic,
}: {
  service: ClientService;
  isArabic: boolean;
}) {
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const status = getServiceStatus(service);
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const progress = Math.max(0, Math.min(Number(service.progress || 0), 100));

  const serviceName = isArabic ? service.serviceNameAr : service.serviceNameEn;
  const planName = isArabic ? service.planNameAr : service.planNameEn;
  const price = isArabic ? service.planPriceAr : service.planPriceEn;

  return (
    <>
      <div className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
        <div className="relative p-6">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gray-100">
            <div
              className={`h-full ${config.progressClass}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 ${config.iconClass}`}>
                <StatusIcon className="h-6 w-6" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-gray-950">
                    {serviceName}
                  </h3>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${config.badgeClass}`}
                  >
                    {isArabic ? config.ar : config.en}
                  </span>
                </div>

                <p className="mt-1 text-sm font-medium text-gray-500">
                  {planName}
                </p>

                <p className="mt-2 text-sm font-black text-blue-600">
                  {price}
                </p>
              </div>
            </div>

            <div
              className={`rounded-2xl px-4 py-3 text-center ${
                isArabic ? 'lg:text-left' : 'lg:text-right'
              }`}
            >
              <p className="text-xs font-bold text-gray-400">
                {isArabic ? 'نسبة التقدم' : 'Progress'}
              </p>
              <p className="mt-1 text-3xl font-black text-gray-950">
                {progress}%
              </p>
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${config.progressClass} transition-all`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <MiniBox
              label={isArabic ? 'الشركة' : 'Company'}
              value={service.companyName}
            />

            <MiniBox
              label={isArabic ? 'الباقة' : 'Plan'}
              value={planName}
            />

            <MiniBox
              label={isArabic ? 'تاريخ الإنشاء' : 'Created At'}
              value={
                service.createdAt
                  ? service.createdAt
                      .toDate()
                      .toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US')
                  : '-'
              }
            />
          </div>

          <CompletionStatusLine
            service={service}
            isArabic={isArabic}
            onOpenModal={() => setShowCompletionModal(true)}
          />

          {service.teamNote && (
            <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black text-gray-400">
                {isArabic ? 'ملاحظة الفريق' : 'Team Note'}
              </p>
              <p className="mt-2 text-sm leading-7 text-gray-600">
                {service.teamNote}
              </p>
            </div>
          )}
        </div>
      </div>

      {showCompletionModal && (
        <CompletionReviewModal
          service={service}
          isArabic={isArabic}
          onClose={() => setShowCompletionModal(false)}
        />
      )}
    </>
  );
}

function CompletionStatusLine({
  service,
  isArabic,
  onOpenModal,
}: {
  service: ClientService;
  isArabic: boolean;
  onOpenModal: () => void;
}) {
  const status = getServiceStatus(service);
  const approvalStatus = service.completionApprovalStatus || 'none';

  if (status !== 'completed') {
    return null;
  }

  if (approvalStatus === 'approved') {
    return (
      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          <p className="text-sm font-black">
            {isArabic
              ? 'تم تأكيد اكتمال الخدمة'
              : 'Service completion approved'}
          </p>
        </div>
      </div>
    );
  }

  if (approvalStatus === 'refused') {
    return (
      <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        <div className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-5 w-5" />
          <div>
            <p className="text-sm font-black">
              {isArabic
                ? 'تم رفض تأكيد اكتمال الخدمة'
                : 'Service completion refused'}
            </p>

            {service.completionRefusalReason && (
              <p className="mt-1 text-sm">
                {service.completionRefusalReason}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-blue-700 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5" />
        <div>
          <p className="text-sm font-black">
            {isArabic
              ? 'الخدمة بانتظار تأكيدك'
              : 'Service is waiting for your confirmation'}
          </p>
          <p className="mt-1 text-xs leading-6 text-blue-600">
            {isArabic
              ? 'راجع الخدمة ثم أكد اكتمالها أو ارفضها مع السبب.'
              : 'Review the service, then approve completion or refuse with a reason.'}
          </p>
        </div>
      </div>

      <button
        onClick={onOpenModal}
        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700"
      >
        {isArabic ? 'مراجعة الاكتمال' : 'Review completion'}
      </button>
    </div>
  );
}

function CompletionReviewModal({
  service,
  isArabic,
  onClose,
}: {
  service: ClientService;
  isArabic: boolean;
  onClose: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState(refusalReasons[0].value);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'approve' | 'refuse'>('approve');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const serviceName = isArabic ? service.serviceNameAr : service.serviceNameEn;
  const planName = isArabic ? service.planNameAr : service.planNameEn;

  const approveCompletion = async () => {
    try {
      setLoading(true);
      setError('');

      await updateDoc(doc(db, 'services', service.id), {
        completionApprovalStatus: 'approved',
        completionRefusalReason: '',
        completionRefusalNote: '',
        clientApprovedCompletionAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onClose();
    } catch (error) {
      console.error(error);
      setError(
        isArabic
          ? 'حدث خطأ أثناء تأكيد اكتمال الخدمة.'
          : 'Failed to approve service completion.'
      );
    } finally {
      setLoading(false);
    }
  };

  const refuseCompletion = async () => {
    try {
      setLoading(true);
      setError('');

      const reason = refusalReasons.find(
        (item) => item.value === selectedReason
      );

      await updateDoc(doc(db, 'services', service.id), {
        completionApprovalStatus: 'refused',
        completionRefusalReason: isArabic ? reason?.ar : reason?.en,
        completionRefusalNote: note,
        clientRefusedCompletionAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onClose();
    } catch (error) {
      console.error(error);
      setError(
        isArabic
          ? 'حدث خطأ أثناء إرسال الرفض.'
          : 'Failed to send refusal.'
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
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                <CheckCircle className="h-4 w-4" />
                {isArabic ? 'مراجعة اكتمال الخدمة' : 'Completion Review'}
              </div>

              <h2 className="mt-4 text-2xl font-black text-gray-950">
                {isArabic
                  ? 'هل تؤكد أن الخدمة انتهت؟'
                  : 'Do you confirm this service is finished?'}
              </h2>

              <p className="mt-2 text-sm leading-7 text-gray-500">
                {isArabic
                  ? 'لا تستطيع الإدارة إنشاء فاتورة لهذه الخدمة حتى توافق أنها انتهت من جهتك.'
                  : 'The admin cannot create an invoice until you confirm that the service is finished from your side.'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-2xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-3xl bg-gray-50 p-5">
            <p className="text-xs font-black text-gray-400">
              {isArabic ? 'الخدمة' : 'Service'}
            </p>

            <h3 className="mt-1 text-xl font-black text-gray-950">
              {serviceName}
            </h3>

            <p className="mt-1 text-sm font-medium text-gray-500">
              {planName}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('approve')}
              className={`rounded-2xl border px-4 py-4 text-sm font-black transition ${
                mode === 'approve'
                  ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-green-50'
              }`}
            >
              <CheckCircle className="mx-auto mb-2 h-5 w-5" />
              {isArabic ? 'أوافق' : 'Approve'}
            </button>

            <button
              type="button"
              onClick={() => setMode('refuse')}
              className={`rounded-2xl border px-4 py-4 text-sm font-black transition ${
                mode === 'refuse'
                  ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-red-50'
              }`}
            >
              <XCircle className="mx-auto mb-2 h-5 w-5" />
              {isArabic ? 'أرفض' : 'Refuse'}
            </button>
          </div>

          {mode === 'approve' && (
            <div className="rounded-3xl border border-green-200 bg-green-50 p-5 text-green-700">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-1 h-5 w-5" />
                <div>
                  <p className="font-black">
                    {isArabic
                      ? 'سيتم تأكيد اكتمال الخدمة'
                      : 'Service completion will be approved'}
                  </p>
                  <p className="mt-1 text-sm leading-7">
                    {isArabic
                      ? 'بعد الموافقة، تستطيع الإدارة إنشاء فاتورة لهذه الخدمة.'
                      : 'After approval, the admin will be able to create an invoice for this service.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {mode === 'refuse' && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
              <p className="mb-3 text-sm font-black text-red-700">
                {isArabic ? 'اختر سبب الرفض' : 'Choose refusal reason'}
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {refusalReasons.map((reason) => {
                  const active = selectedReason === reason.value;

                  return (
                    <button
                      key={reason.value}
                      type="button"
                      onClick={() => setSelectedReason(reason.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                        active
                          ? 'border-red-500 bg-white text-red-700'
                          : 'border-red-100 bg-white/70 text-gray-600 hover:bg-white'
                      }`}
                    >
                      {isArabic ? reason.ar : reason.en}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-3 w-full resize-none rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-400"
                placeholder={
                  isArabic
                    ? 'تفاصيل إضافية اختيارية...'
                    : 'Optional additional details...'
                }
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-6 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          {mode === 'approve' ? (
            <button
              type="button"
              onClick={approveCompletion}
              disabled={loading}
              className="flex-1 rounded-2xl bg-green-600 px-5 py-3 font-black text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading
                ? isArabic
                  ? 'جاري التأكيد...'
                  : 'Approving...'
                : isArabic
                ? 'تأكيد اكتمال الخدمة'
                : 'Confirm Completion'}
            </button>
          ) : (
            <button
              type="button"
              onClick={refuseCompletion}
              disabled={loading}
              className="flex-1 rounded-2xl bg-red-600 px-5 py-3 font-black text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading
                ? isArabic
                  ? 'جاري الإرسال...'
                  : 'Sending...'
                : isArabic
                ? 'إرسال الرفض'
                : 'Send Refusal'}
            </button>
          )}
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
  value: number;
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
        <div
          className={`rounded-2xl px-3 py-2 text-xs font-black ${styles[tone]}`}
        >
          LIVE
        </div>
      </div>

      <p className="mt-4 text-4xl font-black text-gray-950">{value}</p>
    </div>
  );
}

function MiniBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs font-black text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}