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
  BriefcaseBusiness,
  Building2,
  CheckCircle,
  Clock3,
  Mail,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

type ServiceStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_client'
  | 'completed'
  | 'paused';

type CompletionApprovalStatus = 'none' | 'pending' | 'approved' | 'refused';

type CurrentService = {
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

  status: ServiceStatus;
  progress: number;

  completionApprovalStatus?: CompletionApprovalStatus;
  completionRefusalReason?: string;
  completionRefusalNote?: string;

  adminNote?: string;
  teamNote?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const statusOptions: {
  value: ServiceStatus;
  ar: string;
  en: string;
}[] = [
  { value: 'not_started', ar: 'لم تبدأ', en: 'Not Started' },
  { value: 'in_progress', ar: 'قيد العمل', en: 'In Progress' },
  { value: 'waiting_client', ar: 'بانتظار العميل', en: 'Waiting for Client' },
  { value: 'completed', ar: 'مكتملة', en: 'Completed' },
  { value: 'paused', ar: 'متوقفة مؤقتاً', en: 'Paused' },
];

export const CurrentServices: React.FC = () => {
  const { isArabic } = useLanguage();

  const [services, setServices] = useState<CurrentService[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as CurrentService[];

        setServices(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        setMessage(
          isArabic
            ? 'تعذر تحميل الخدمات الحالية. تحقق من صلاحيات Firestore أو الفهارس.'
            : 'Could not load current services. Check Firestore permissions or indexes.'
        );
      }
    );

    return () => unsubscribe();
  }, [isArabic]);

  const createStatusNotification = async (service: CurrentService) => {
    const statusAr = getStatusLabel(service.status, true);
    const statusEn = getStatusLabel(service.status, false);

    const isCompleted = service.status === 'completed';

    await addDoc(collection(db, 'notifications'), {
      clientId: service.clientId,
      type: 'service_status_updated',
      titleAr: isCompleted
        ? 'الخدمة جاهزة للتأكيد'
        : 'تم تحديث حالة الخدمة',
      titleEn: isCompleted
        ? 'Service ready for confirmation'
        : 'Service status updated',
      messageAr: isCompleted
        ? `تم تحديد خدمة ${service.serviceNameAr} كمكتملة. يرجى تأكيد إن كانت الخدمة منتهية من جهتك.`
        : `تم تحديث حالة خدمة ${service.serviceNameAr} إلى: ${statusAr}. نسبة التقدم الحالية: ${service.progress}%.`,
      messageEn: isCompleted
        ? `Your ${service.serviceNameEn} service was marked as completed. Please confirm if it is finished from your side.`
        : `Your ${service.serviceNameEn} service status was updated to: ${statusEn}. Current progress: ${service.progress}%.`,
      isRead: false,
      createdAt: serverTimestamp(),
      serviceId: service.id,
      serviceNameAr: service.serviceNameAr,
      serviceNameEn: service.serviceNameEn,
      status: service.status,
      progress: service.progress,
    });
  };

  const updateService = async (
  service: CurrentService,
  updates: Partial<CurrentService>,
  notifyClient = false
) => {
  try {
    setProcessingId(service.id);
    setMessage('');

    const nextStatus: ServiceStatus =
      updates.status ?? service.status ?? 'not_started';

    const finalProgress =
      nextStatus === 'completed'
        ? 100
        : Number(updates.progress ?? service.progress ?? 0);

    let completionApprovalStatus: CompletionApprovalStatus = 'none';

    if (nextStatus === 'completed') {
      if (
        service.completionApprovalStatus === 'approved' ||
        service.completionApprovalStatus === 'refused'
      ) {
        completionApprovalStatus = service.completionApprovalStatus;
      } else {
        completionApprovalStatus = 'pending';
      }
    }

    const payload = {
      ...updates,
      status: nextStatus,
      progress: finalProgress,
      completionApprovalStatus,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'services', service.id), payload);

    if (notifyClient) {
      await createStatusNotification({
        ...service,
        ...updates,
        status: nextStatus,
        progress: finalProgress,
        completionApprovalStatus,
      } as CurrentService);
    }

    setMessage(
      isArabic
        ? 'تم تحديث الخدمة وإشعار العميل بنجاح.'
        : 'Service updated and client notified successfully.'
    );
  } catch (error) {
    console.error(error);
    setMessage(
      isArabic
        ? 'حدث خطأ أثناء تحديث الخدمة.'
        : 'Failed to update service.'
    );
  } finally {
    setProcessingId(null);
  }
};
  const totalCount = services.length;
  const activeCount = services.filter((s) => s.status === 'in_progress').length;
  const waitingCount = services.filter(
    (s) => s.status === 'waiting_client'
  ).length;
  const completedCount = services.filter((s) => s.status === 'completed').length;

  return (
    <div className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <BriefcaseBusiness className="h-4 w-4" />
          {isArabic ? 'إدارة الخدمات' : 'Services Management'}
        </div>

        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic ? 'الخدمات الحالية' : 'Current Services'}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'تابع الخدمات المقبولة، حدّث حالتها، نسبة التقدم، وموافقة العميل النهائية.'
            : 'Track accepted services, update status, progress, and final client confirmation.'}
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
          label={isArabic ? 'كل الخدمات' : 'All Services'}
          value={totalCount}
          tone="blue"
        />
        <StatsCard
          label={isArabic ? 'قيد العمل' : 'In Progress'}
          value={activeCount}
          tone="green"
        />
        <StatsCard
          label={isArabic ? 'بانتظار العميل' : 'Waiting Client'}
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
        <div className="mb-6">
          <h2 className="text-xl font-black text-gray-950">
            {isArabic ? 'قائمة الخدمات' : 'Services List'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isArabic
              ? 'لا يمكن إنشاء فاتورة إلا بعد اكتمال الخدمة وموافقة العميل عليها.'
              : 'Invoices can only be created after the service is completed and approved by the client.'}
          </p>
        </div>

        {loading && (
          <p className="py-10 text-center text-gray-500">
            {isArabic ? 'جاري تحميل الخدمات...' : 'Loading services...'}
          </p>
        )}

        {!loading && services.length === 0 && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-4 font-bold text-gray-600">
              {isArabic
                ? 'لا توجد خدمات حالية بعد. عند قبول طلب خدمة ستظهر هنا.'
                : 'No current services yet. Accepted service requests will appear here.'}
            </p>
          </div>
        )}

        {!loading && services.length > 0 && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isArabic={isArabic}
                processingId={processingId}
                onUpdate={updateService}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

function ServiceCard({
  service,
  isArabic,
  processingId,
  onUpdate,
}: {
  service: CurrentService;
  isArabic: boolean;
  processingId: string | null;
  onUpdate: (
    service: CurrentService,
    updates: Partial<CurrentService>,
    notifyClient?: boolean
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<ServiceStatus>(service.status);
  const [progress, setProgress] = useState(service.progress || 0);
  const [teamNote, setTeamNote] = useState(service.teamNote || '');
  const [adminNote, setAdminNote] = useState(service.adminNote || '');

  useEffect(() => {
    setStatus(service.status);
    setProgress(service.progress || 0);
    setTeamNote(service.teamNote || '');
    setAdminNote(service.adminNote || '');
  }, [service]);

  useEffect(() => {
    if (status === 'completed') {
      setProgress(100);
    }
  }, [status]);

  const approvalStatus = service.completionApprovalStatus || 'none';

  const saveChanges = async () => {
    const finalProgress = status === 'completed' ? 100 : Number(progress);

    await onUpdate(
      service,
      {
        status,
        progress: finalProgress,
        teamNote,
        adminNote,
      },
      true
    );
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/60">
              {isArabic ? 'خدمة حالية' : 'Current Service'}
            </p>

            <h3 className="mt-2 text-2xl font-black">
              {isArabic ? service.serviceNameAr : service.serviceNameEn}
            </h3>

            <p className="mt-2 text-sm text-white/70">
              {isArabic ? service.planNameAr : service.planNameEn}
            </p>
          </div>

          <StatusBadge status={status} isArabic={isArabic} />
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoItem
            icon={<Building2 className="h-5 w-5" />}
            label={isArabic ? 'الشركة' : 'Company'}
            value={service.companyName}
          />

          <InfoItem
            icon={<Mail className="h-5 w-5" />}
            label={isArabic ? 'العميل' : 'Client'}
            value={service.clientName}
            subValue={service.clientEmail}
          />
        </div>

        <div className="rounded-3xl bg-gray-50 p-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <SmallInfo
              label={isArabic ? 'الخدمة' : 'Service'}
              value={isArabic ? service.serviceNameAr : service.serviceNameEn}
            />
            <SmallInfo
              label={isArabic ? 'الباقة' : 'Plan'}
              value={isArabic ? service.planNameAr : service.planNameEn}
            />
            <SmallInfo
              label={isArabic ? 'السعر' : 'Price'}
              value={isArabic ? service.planPriceAr : service.planPriceEn}
              blue
            />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-700">
                {isArabic ? 'نسبة التقدم' : 'Progress'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {isArabic
                  ? 'عند اختيار مكتملة تصبح النسبة 100% تلقائياً.'
                  : 'When Completed is selected, progress becomes 100% automatically.'}
              </p>
            </div>

            <div className="rounded-2xl bg-blue-50 px-4 py-2 text-xl font-black text-blue-700">
              {progress}%
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            disabled={status === 'completed'}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="mt-3 flex justify-between text-xs font-bold text-gray-400">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-gray-700">
            {isArabic ? 'حالة الخدمة' : 'Service Status'}
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {statusOptions.map((option) => {
              const active = status === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/50'
                  }`}
                >
                  {isArabic ? option.ar : option.en}
                </button>
              );
            })}
          </div>
        </div>

        <CompletionApprovalBox
          status={approvalStatus}
          service={service}
          isArabic={isArabic}
        />

        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            {isArabic ? 'ملاحظة الفريق' : 'Team Note'}
          </label>

          <textarea
            value={teamNote}
            onChange={(e) => setTeamNote(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              isArabic
                ? 'مثلاً: تم الانتهاء من المرحلة الأولى...'
                : 'Example: First phase has been completed...'
            }
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-gray-700">
            {isArabic ? 'ملاحظة داخلية للإدارة' : 'Internal Admin Note'}
          </label>

          <textarea
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={
              isArabic
                ? 'ملاحظة لا تظهر للعميل...'
                : 'A note that is not shown to the client...'
            }
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock3 className="h-4 w-4" />
          {service.createdAt
            ? service.createdAt
                .toDate()
                .toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US')
            : '-'}
        </div>

        <button
          onClick={saveChanges}
          disabled={processingId === service.id}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
          {processingId === service.id
            ? isArabic
              ? 'جاري الحفظ...'
              : 'Saving...'
            : isArabic
            ? 'حفظ التحديث وإشعار العميل'
            : 'Save Update & Notify Client'}
        </button>
      </div>
    </div>
  );
}

function CompletionApprovalBox({
  status,
  service,
  isArabic,
}: {
  status: CompletionApprovalStatus;
  service: CurrentService;
  isArabic: boolean;
}) {
  if (service.status !== 'completed') {
    return (
      <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
        <p className="text-sm font-bold text-gray-500">
          {isArabic ? 'موافقة العميل النهائية' : 'Final Client Approval'}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {isArabic
            ? 'ستظهر الموافقة بعد تحديد الخدمة كمكتملة.'
            : 'Approval will appear after marking the service as completed.'}
        </p>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="rounded-3xl border border-green-200 bg-green-50 p-5 text-green-700">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5" />
          <div>
            <p className="font-black">
              {isArabic ? 'العميل وافق على اكتمال الخدمة' : 'Client approved completion'}
            </p>
            <p className="mt-1 text-sm">
              {isArabic
                ? 'يمكن الآن إنشاء فاتورة لهذه الخدمة.'
                : 'You can now create an invoice for this service.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'refused') {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
        <div className="flex items-start gap-3">
          <XCircle className="mt-1 h-5 w-5" />
          <div>
            <p className="font-black">
              {isArabic ? 'العميل رفض تأكيد اكتمال الخدمة' : 'Client refused completion'}
            </p>
            <p className="mt-2 text-sm font-bold">
              {isArabic ? 'السبب:' : 'Reason:'}{' '}
              {service.completionRefusalReason || '-'}
            </p>
            {service.completionRefusalNote && (
              <p className="mt-2 text-sm leading-7">
                {service.completionRefusalNote}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5" />
        <div>
          <p className="font-black">
            {isArabic ? 'بانتظار موافقة العميل' : 'Waiting for client approval'}
          </p>
          <p className="mt-1 text-sm">
            {isArabic
              ? 'لا يمكن إنشاء فاتورة حتى يؤكد العميل أن الخدمة انتهت.'
              : 'An invoice cannot be created until the client confirms the service is finished.'}
          </p>
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
        <div className={`rounded-2xl px-3 py-2 text-xs font-black ${styles[tone]}`}>
          LIVE
        </div>
      </div>

      <p className="mt-4 text-4xl font-black text-gray-950">{value}</p>
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

function SmallInfo({
  label,
  value,
  blue,
}: {
  label: string;
  value: string;
  blue?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p className={`mt-1 font-bold ${blue ? 'text-blue-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
  isArabic,
}: {
  status: ServiceStatus;
  isArabic: boolean;
}) {
  const styles: Record<ServiceStatus, string> = {
    not_started: 'bg-gray-400/15 text-gray-100 border-gray-300/20',
    in_progress: 'bg-blue-400/15 text-blue-200 border-blue-300/20',
    waiting_client: 'bg-yellow-400/15 text-yellow-200 border-yellow-300/20',
    completed: 'bg-green-400/15 text-green-200 border-green-300/20',
    paused: 'bg-red-400/15 text-red-200 border-red-300/20',
  };

  return (
    <span
      className={`rounded-full border px-4 py-2 text-xs font-black ${styles[status]}`}
    >
      {getStatusLabel(status, isArabic)}
    </span>
  );
}

function getStatusLabel(status: ServiceStatus, isArabic: boolean) {
  const option = statusOptions.find((item) => item.value === status);
  return option ? (isArabic ? option.ar : option.en) : status;
}