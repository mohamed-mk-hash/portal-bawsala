import React, { useEffect, useState } from 'react';
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
  Building2,
  CheckCircle,
  Clock3,
  Mail,
  PackageCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

type ServiceRequest = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  serviceId: string;
  serviceNameAr: string;
  serviceNameEn: string;
  planId: string;
  planNameAr: string;
  planNameEn: string;
  planPriceAr: string;
  planPriceEn: string;
  status: 'pending' | 'accepted' | 'refused';
  createdAt?: Timestamp;
  refusalReason?: string;
  refusalReasonAr?: string;
  refusalReasonEn?: string;
};

type RefusalReason = {
  id: string;
  ar: string;
  en: string;
};

const refusalReasons: RefusalReason[] = [
  {
    id: 'service_unavailable',
    ar: 'الخدمة غير متاحة حالياً',
    en: 'The service is currently unavailable',
  },
  {
    id: 'plan_not_suitable',
    ar: 'الباقة المختارة غير مناسبة لاحتياجات الطلب',
    en: 'The selected plan is not suitable for this request',
  },
  {
    id: 'need_more_info',
    ar: 'نحتاج معلومات إضافية قبل معالجة الطلب',
    en: 'We need more information before processing the request',
  },
  {
    id: 'outside_scope',
    ar: 'الطلب لا يناسب نطاق خدمات الشركة حالياً',
    en: 'The request is currently outside the company service scope',
  },
];

export const ServiceRequests: React.FC = () => {
  const { isArabic } = useLanguage();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [refuseModalRequest, setRefuseModalRequest] =
    useState<ServiceRequest | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState(refusalReasons[0].id);

  useEffect(() => {
    const q = query(
      collection(db, 'serviceRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as ServiceRequest[];

        setRequests(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setMessage(
          isArabic
            ? 'لا يمكن تحميل طلبات الخدمة. تحقق من صلاحيات Firestore.'
            : 'Could not load service requests. Check Firestore permissions.'
        );
      }
    );

    return () => unsubscribe();
  }, [isArabic]);

  const createNotification = async ({
    request,
    type,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
  }: {
    request: ServiceRequest;
    type: 'service_accepted' | 'service_refused';
    titleAr: string;
    titleEn: string;
    messageAr: string;
    messageEn: string;
  }) => {
    await addDoc(collection(db, 'notifications'), {
      clientId: request.clientId,
      type,
      titleAr,
      titleEn,
      messageAr,
      messageEn,
      isRead: false,
      createdAt: serverTimestamp(),
      serviceRequestId: request.id,
      serviceNameAr: request.serviceNameAr,
      serviceNameEn: request.serviceNameEn,
      planNameAr: request.planNameAr,
      planNameEn: request.planNameEn,
    });
  };

  const acceptRequest = async (request: ServiceRequest) => {
    try {
      setProcessingId(request.id);
      setMessage('');

      await updateDoc(doc(db, 'serviceRequests', request.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'services'), {
  clientId: request.clientId,
  clientName: request.clientName,
  clientEmail: request.clientEmail,
  companyName: request.companyName,

  serviceRequestId: request.id,

  serviceId: request.serviceId,
  serviceNameAr: request.serviceNameAr,
  serviceNameEn: request.serviceNameEn,

  planId: request.planId,
  planNameAr: request.planNameAr,
  planNameEn: request.planNameEn,

  planPriceAr: request.planPriceAr,
  planPriceEn: request.planPriceEn,

  status: 'not_started',
  progress: 0,
  adminNote: '',
  teamNote: '',

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

      await createNotification({
        request,
        type: 'service_accepted',
        titleAr: 'تم قبول طلب الخدمة',
        titleEn: 'Service request accepted',
        messageAr: `تم قبول طلبك لخدمة ${request.serviceNameAr} - باقة ${request.planNameAr}. ستبدأ الإدارة في معالجة الخدمة قريباً.`,
        messageEn: `Your request for ${request.serviceNameEn} - ${request.planNameEn} plan has been accepted. The admin team will start processing it soon.`,
      });

      setMessage(
        isArabic
          ? 'تم قبول طلب الخدمة وإرسال إشعار للعميل.'
          : 'Service request accepted and notification sent to the client.'
      );
    } catch (error) {
      console.error(error);
      setMessage(
        isArabic
          ? 'حدث خطأ أثناء قبول طلب الخدمة.'
          : 'Failed to accept service request.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const openRefuseModal = (request: ServiceRequest) => {
    setSelectedReasonId(refusalReasons[0].id);
    setRefuseModalRequest(request);
  };

  const closeRefuseModal = () => {
    setRefuseModalRequest(null);
    setSelectedReasonId(refusalReasons[0].id);
  };

  const confirmRefuseRequest = async () => {
    if (!refuseModalRequest) return;

    const selectedReason =
      refusalReasons.find((reason) => reason.id === selectedReasonId) ||
      refusalReasons[0];

    try {
      setProcessingId(refuseModalRequest.id);
      setMessage('');

      await updateDoc(doc(db, 'serviceRequests', refuseModalRequest.id), {
        status: 'refused',
        refusalReason: isArabic ? selectedReason.ar : selectedReason.en,
        refusalReasonAr: selectedReason.ar,
        refusalReasonEn: selectedReason.en,
        refusedAt: serverTimestamp(),
      });

      await createNotification({
        request: refuseModalRequest,
        type: 'service_refused',
        titleAr: 'تم رفض طلب الخدمة',
        titleEn: 'Service request refused',
        messageAr: `تم رفض طلبك لخدمة ${refuseModalRequest.serviceNameAr} - باقة ${refuseModalRequest.planNameAr}. سبب الرفض: ${selectedReason.ar}`,
        messageEn: `Your request for ${refuseModalRequest.serviceNameEn} - ${refuseModalRequest.planNameEn} plan was refused. Reason: ${selectedReason.en}`,
      });

      setMessage(
        isArabic
          ? 'تم رفض طلب الخدمة وإرسال إشعار للعميل.'
          : 'Service request refused and notification sent to the client.'
      );

      closeRefuseModal();
    } catch (error) {
      console.error(error);
      setMessage(
        isArabic
          ? 'حدث خطأ أثناء رفض طلب الخدمة.'
          : 'Failed to refuse service request.'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length;
  const refusedCount = requests.filter((r) => r.status === 'refused').length;

  return (
    <div className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <Sparkles className="h-4 w-4" />
          {isArabic ? 'لوحة الإدارة' : 'Admin Dashboard'}
        </div>

        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'طلبات الخدمة' : 'Service Requests'}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'راجع طلبات العملاء، اقبل المناسب منها أو ارفضها مع إرسال إشعار مباشر للعميل.'
            : 'Review client requests, accept or refuse them, and notify the client directly.'}
        </p>
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
          label={isArabic ? 'كل الطلبات' : 'All Requests'}
          value={requests.length}
          tone="blue"
        />
        <StatsCard
          label={isArabic ? 'قيد المراجعة' : 'Pending'}
          value={pendingCount}
          tone="yellow"
        />
        <StatsCard
          label={isArabic ? 'مقبولة' : 'Accepted'}
          value={acceptedCount}
          tone="green"
        />
        <StatsCard
          label={isArabic ? 'مرفوضة' : 'Refused'}
          value={refusedCount}
          tone="red"
        />
      </div>

      <Card>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">
              {isArabic ? 'أحدث الطلبات' : 'Latest Requests'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'كل طلب يظهر كبطاقة منفصلة ليسهل مراجعته بسرعة.'
                : 'Each request appears as a modern card for quick review.'}
            </p>
          </div>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الطلبات...' : 'Loading requests...'}
          </p>
        )}

        {!loading && requests.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <PackageCheck className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-4 font-bold text-gray-600">
              {isArabic ? 'لا توجد طلبات خدمة حالياً.' : 'No service requests yet.'}
            </p>
          </div>
        )}

        {!loading && requests.length > 0 && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                isArabic={isArabic}
                processingId={processingId}
                onAccept={() => acceptRequest(request)}
                onOpenRefuse={() => openRefuseModal(request)}
              />
            ))}
          </div>
        )}
      </Card>

      {refuseModalRequest && (
        <RefuseRequestModal
          request={refuseModalRequest}
          isArabic={isArabic}
          selectedReasonId={selectedReasonId}
          setSelectedReasonId={setSelectedReasonId}
          processingId={processingId}
          onClose={closeRefuseModal}
          onConfirm={confirmRefuseRequest}
        />
      )}
    </div>
  );
};

function StatsCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
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
      <p className="mt-4 text-4xl font-black text-gray-950">{value}</p>
    </div>
  );
}

function RequestCard({
  request,
  isArabic,
  processingId,
  onAccept,
  onOpenRefuse,
}: {
  request: ServiceRequest;
  isArabic: boolean;
  processingId: string | null;
  onAccept: () => void;
  onOpenRefuse: () => void;
}) {
  const isPending = request.status === 'pending';

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="border-b border-gray-100 bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/60">
              {isArabic ? 'طلب خدمة جديد' : 'New service request'}
            </p>

            <h3 className="mt-2 text-2xl font-black">
              {isArabic ? request.serviceNameAr : request.serviceNameEn}
            </h3>

            <p className="mt-2 text-sm text-white/70">
              {isArabic ? request.planNameAr : request.planNameEn}
            </p>
          </div>

          <StatusBadge status={request.status} isArabic={isArabic} />
        </div>
      </div>

      <div className="p-6">
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoItem
            icon={<Building2 className="h-5 w-5" />}
            label={isArabic ? 'الشركة' : 'Company'}
            value={request.companyName}
          />

          <InfoItem
            icon={<Mail className="h-5 w-5" />}
            label={isArabic ? 'العميل' : 'Client'}
            value={request.clientName}
            subValue={request.clientEmail}
          />
        </div>

        <div className="rounded-3xl bg-gray-50 p-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-gray-400">
                {isArabic ? 'الخدمة' : 'Service'}
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {isArabic ? request.serviceNameAr : request.serviceNameEn}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400">
                {isArabic ? 'الباقة' : 'Plan'}
              </p>
              <p className="mt-1 font-bold text-gray-900">
                {isArabic ? request.planNameAr : request.planNameEn}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400">
                {isArabic ? 'السعر' : 'Price'}
              </p>
              <p className="mt-1 font-black text-blue-600">
                {isArabic ? request.planPriceAr : request.planPriceEn}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-sm text-gray-500">
          <Clock3 className="h-4 w-4" />
          {request.createdAt
            ? request.createdAt
                .toDate()
                .toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US')
            : '-'}
        </div>

        {isPending ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={onAccept}
              disabled={processingId === request.id}
              className="flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-5 w-5" />
              {processingId === request.id
                ? isArabic
                  ? 'جاري...'
                  : 'Loading...'
                : isArabic
                ? 'قبول الطلب'
                : 'Accept'}
            </button>

            <button
              onClick={onOpenRefuse}
              disabled={processingId === request.id}
              className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
            >
              <XCircle className="h-5 w-5" />
              {isArabic ? 'رفض الطلب' : 'Refuse'}
            </button>
          </div>
        ) : (
          <ProcessedBox request={request} isArabic={isArabic} />
        )}
      </div>
    </div>
  );
}

function ProcessedBox({
  request,
  isArabic,
}: {
  request: ServiceRequest;
  isArabic: boolean;
}) {
  if (request.status === 'accepted') {
    return (
      <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-700">
        {isArabic ? 'تم قبول هذا الطلب' : 'This request has been accepted'}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
      <p className="font-bold text-red-700">
        {isArabic ? 'تم رفض هذا الطلب' : 'This request has been refused'}
      </p>

      {(request.refusalReasonAr || request.refusalReasonEn || request.refusalReason) && (
        <p className="mt-2 text-sm leading-6 text-red-600">
          {isArabic
            ? request.refusalReasonAr || request.refusalReason
            : request.refusalReasonEn || request.refusalReason}
        </p>
      )}
    </div>
  );
}

function RefuseRequestModal({
  request,
  isArabic,
  selectedReasonId,
  setSelectedReasonId,
  processingId,
  onClose,
  onConfirm,
}: {
  request: ServiceRequest;
  isArabic: boolean;
  selectedReasonId: string;
  setSelectedReasonId: (value: string) => void;
  processingId: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                <XCircle className="h-4 w-4" />
                {isArabic ? 'رفض طلب خدمة' : 'Refuse service request'}
              </div>

              <h2 className="text-2xl font-black text-gray-950">
                {isArabic ? request.serviceNameAr : request.serviceNameEn}
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {isArabic
                  ? 'اختر سبب الرفض الذي سيظهر للعميل داخل لوحة التحكم.'
                  : 'Choose the refusal reason that will be shown to the client inside the dashboard.'}
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

        <div className="space-y-3 p-6">
          {refusalReasons.map((reason) => {
            const active = selectedReasonId === reason.id;

            return (
              <button
                key={reason.id}
                onClick={() => setSelectedReasonId(reason.id)}
                className={`w-full rounded-2xl border p-4 text-start transition ${
                  active
                    ? 'border-red-400 bg-red-50 ring-2 ring-red-100'
                    : 'border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? 'border-red-600 bg-red-600'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {active && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>

                  <div>
                    <p className="font-bold text-gray-900">
                      {isArabic ? reason.ar : reason.en}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {isArabic ? reason.en : reason.ar}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 p-6 sm:flex-row">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:bg-gray-100"
          >
            {isArabic ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            onClick={onConfirm}
            disabled={processingId === request.id}
            className="flex-1 rounded-2xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {processingId === request.id
              ? isArabic
                ? 'جاري الرفض...'
                : 'Refusing...'
              : isArabic
              ? 'تأكيد الرفض'
              : 'Confirm Refusal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4">
      <div className="rounded-xl bg-blue-50 p-2 text-blue-600">{icon}</div>
      <div>
        <p className="text-xs font-bold text-gray-400">{label}</p>
        <p className="mt-1 font-bold text-gray-900">{value}</p>
        {subValue && <p className="mt-1 text-xs text-gray-500">{subValue}</p>}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  isArabic,
}: {
  status: ServiceRequest['status'];
  isArabic: boolean;
}) {
  const config = {
    pending: {
      className: 'bg-yellow-400/15 text-yellow-200 border-yellow-300/20',
      label: isArabic ? 'قيد المراجعة' : 'Pending',
    },
    accepted: {
      className: 'bg-green-400/15 text-green-200 border-green-300/20',
      label: isArabic ? 'مقبول' : 'Accepted',
    },
    refused: {
      className: 'bg-red-400/15 text-red-200 border-red-300/20',
      label: isArabic ? 'مرفوض' : 'Refused',
    },
  };

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black ${config[status].className}`}
    >
      {config[status].label}
    </span>
  );
}