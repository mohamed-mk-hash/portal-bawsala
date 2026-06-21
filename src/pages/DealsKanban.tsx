import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { BriefcaseBusiness, CheckCircle2, Clock3, Search } from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';
import type { DealRecord } from '../types/adminDashboard';
import { useAuth } from '../auth/AuthContext';


type KanbanDealRecord = DealRecord & {
  clientApprovalStatus?: string;
  approvalActivityCreated?: boolean;
  approvalActivityCreatedAt?: unknown;
  feedbackActivityCreated?: boolean;
  feedbackActivityCreatedAt?: unknown;
  ownerEmail?: string;
  ownerUid?: string;
};

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

const priorities = ['High', 'Medium', 'Low'];

const DEFAULT_STAGE = 'عميل محتمل';
const FEEDBACK_STAGE = 'تسليم وتقييم';
const FEEDBACK_NEXT_ACTION = 'إرسال استبيان رضا للعميل';

const addDaysIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 10);
};

const getTodayIso = () => addDaysIso(0);

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const isDealAccepted = (deal: KanbanDealRecord) => {
  const approvalStatus = normalize(deal.clientApprovalStatus);
  const dealStatus = normalize(deal.dealStatus);

  return (
    approvalStatus === 'approved' ||
    approvalStatus === 'accepted' ||
    dealStatus === 'won'
  );
};

const isDealPending = (deal: KanbanDealRecord) => {
  const approvalStatus = normalize(deal.clientApprovalStatus);
  const dealStatus = normalize(deal.dealStatus);

  return approvalStatus === 'pending' || dealStatus === 'open';
};

const formatMoney = (amount: number, currency = 'DZD') => {
  return `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: currency === 'DZD' ? 0 : 2,
    maximumFractionDigits: currency === 'DZD' ? 0 : 2,
  })} ${currency}`;
};

const getDealTitle = (deal: KanbanDealRecord) => {
  return deal.dealTitle || deal.productService || '-';
};

const getClientName = (deal: KanbanDealRecord) => {
  return deal.clientName || deal.companyName || '-';
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

const priorityTone = (priority?: string) => {
  if (priority === 'High') return 'bg-red-100 text-red-700';
  if (priority === 'Medium') return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
};

export const DealsKanban: React.FC = () => {
  const { isArabic } = useLanguage();

  const [deals, setDeals] = useState<KanbanDealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);

  const { profile, role, user } = useAuth();
  const syncingApprovalActivities = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'deals'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setDeals(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as KanbanDealRecord[]
        );

        setLoading(false);
      },
      (firestoreError) => {
        console.error(firestoreError);
        setLoading(false);
        setError(isArabic ? 'تعذر تحميل الصفقات.' : 'Could not load deals.');
      }
    );

    return () => unsubscribe();
  }, [isArabic]);

  const acceptedDeals = useMemo(() => {
    return deals.filter(isDealAccepted);
  }, [deals]);

  const pendingApprovalCount = useMemo(() => {
    return deals.filter((deal) => !isDealAccepted(deal) && isDealPending(deal)).length;
  }, [deals]);

  useEffect(() => {
    const createMissingApprovalActivities = async () => {
      const dealsToSync = acceptedDeals.filter(
        (deal) =>
          !deal.approvalActivityCreated &&
          !syncingApprovalActivities.current.has(deal.id)
      );

      for (const deal of dealsToSync) {
        syncingApprovalActivities.current.add(deal.id);

        try {
          await setDoc(
            doc(db, 'activities', `deal_approved_${deal.id}`),
            {
              recordType: 'activity',
              subject: `متابعة الصفقة بعد موافقة العميل: ${getDealTitle(deal)}`,
              type: 'Task',
              dueDate: addDaysIso(3),
              status: 'Undone',
              department: deal.department || '',
              owner: deal.owner || '',
              ownerUid: deal.ownerUid || '',
              ownerEmail: deal.ownerEmail || '',
              nextAction: deal.nextAction || 'متابعة تنفيذ الصفقة بعد موافقة العميل',
              notes: 'تم إنشاء هذه المهمة تلقائياً بعد موافقة العميل على الصفقة.',
              clientId: deal.clientId || '',
              clientName: getClientName(deal),
              clientEmail: deal.clientEmail || deal.contactEmail || '',
              dealId: deal.id,
              dealTitle: getDealTitle(deal),
              pipeline: deal.pipeline || '',
              source: 'client_deal_approval',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await updateDoc(doc(db, 'deals', deal.id), {
            approvalActivityCreated: true,
            approvalActivityCreatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (syncError) {
          console.error(syncError);
          syncingApprovalActivities.current.delete(deal.id);
          setError(
            isArabic
              ? 'تمت الموافقة على صفقة، لكن تعذر إنشاء المهمة الخاصة بها. تحقق من صلاحيات Firestore.'
              : 'A deal was approved, but its activity could not be created. Check Firestore permissions.'
          );
        }
      }
    };

    if (acceptedDeals.length > 0) {
      createMissingApprovalActivities();
    }
  }, [acceptedDeals, isArabic]);

  const pipelines = useMemo(() => {
    return Array.from(
      new Set(acceptedDeals.map((deal) => deal.pipeline).filter(Boolean))
    ) as string[];
  }, [acceptedDeals]);

  const allStageOptions = useMemo(() => {
    const stagesFromDeals = Array.from(
      new Set(acceptedDeals.map((deal) => deal.stage).filter(Boolean))
    ) as string[];

    return Array.from(new Set([...stages, ...stagesFromDeals]));
  }, [acceptedDeals]);

const filteredDeals = useMemo(() => {
  const text = search.trim().toLowerCase();

  return deals.filter((deal) => {
    const isAcceptedByClient =
      deal.clientApprovalStatus === 'approved' ||
      deal.clientApprovalStatus === 'accepted' ||
      deal.dealStatus === 'Won';

    if (!isAcceptedByClient) return false;

    const isSuperAdmin =
      role === 'admin' || role === 'super_admin';

    const isDepartmentHead = role === 'department_head';

    const isOwner = role === 'owner';

    const canSeeByRole =
      isSuperAdmin ||
      (
        isDepartmentHead &&
        profile?.department &&
        deal.department === profile.department
      ) ||
      (
        isOwner &&
        (
          deal.ownerUid === user?.uid ||
          deal.ownerEmail === user?.email ||
          deal.owner === profile?.ownerName ||
          deal.owner === profile?.fullName
        )
      );

    if (!canSeeByRole) return false;

    const matchesText =
      !text ||
      [
        deal.clientName,
        deal.companyName,
        deal.dealTitle,
        deal.productService,
        deal.pipeline,
        deal.stage,
        deal.owner,
        deal.department,
        deal.budgetRange,
        deal.priority,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text);

    const matchesPipeline =
      pipelineFilter === 'all' || deal.pipeline === pipelineFilter;

    const matchesPriority =
      priorityFilter === 'all' || deal.priority === priorityFilter;

    return matchesText && matchesPipeline && matchesPriority;
  });
}, [deals, search, pipelineFilter, priorityFilter, role, profile, user]);

  const dealsByStage = useMemo(() => {
    return allStageOptions.reduce<Record<string, KanbanDealRecord[]>>((result, stage) => {
      result[stage] = filteredDeals.filter(
        (deal) => (deal.stage || DEFAULT_STAGE) === stage
      );

      return result;
    }, {});
  }, [allStageOptions, filteredDeals]);

  const visibleStages = useMemo(() => {
    const activeStages = allStageOptions.filter(
      (stage) => (dealsByStage[stage] || []).length > 0
    );

    if (!activeStages.includes(FEEDBACK_STAGE)) {
      activeStages.push(FEEDBACK_STAGE);
    }

    return activeStages;
  }, [allStageOptions, dealsByStage]);

  const updateDealStage = async (dealId: string, newStage: string) => {
    const deal = deals.find((item) => item.id === dealId);

    if (!deal) return;

    if (!isDealAccepted(deal)) {
      setError(
        isArabic
          ? 'لا يمكن تحريك الصفقة قبل موافقة العميل عليها.'
          : 'This deal cannot be moved before the client accepts it.'
      );
      return;
    }

    if ((deal.stage || DEFAULT_STAGE) === newStage) return;

    try {
      const isFeedbackStage = newStage === FEEDBACK_STAGE;

      await updateDoc(doc(db, 'deals', dealId), {
        stage: newStage,
        ...(isFeedbackStage ? { nextAction: FEEDBACK_NEXT_ACTION } : {}),
        updatedAt: serverTimestamp(),
      });

      if (isFeedbackStage && !deal.feedbackActivityCreated) {
        await setDoc(
          doc(db, 'activities', `deal_feedback_${deal.id}`),
          {
            recordType: 'activity',
            subject: FEEDBACK_NEXT_ACTION,
            type: 'Task',
            dueDate: getTodayIso(),
            status: 'Undone',
            department: deal.department || '',
            owner: deal.owner || '',
            ownerUid: deal.ownerUid || '',
            ownerEmail: deal.ownerEmail || '',
            nextAction: FEEDBACK_NEXT_ACTION,
            notes: `تم نقل الصفقة إلى مرحلة ${FEEDBACK_STAGE}. يجب إرسال استبيان رضا للعميل.`,
            clientId: deal.clientId || '',
            clientName: getClientName(deal),
            clientEmail: deal.clientEmail || deal.contactEmail || '',
            dealId: deal.id,
            dealTitle: getDealTitle(deal),
            pipeline: deal.pipeline || '',
            source: 'stage_feedback_automation',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await updateDoc(doc(db, 'deals', deal.id), {
          feedbackActivityCreated: true,
          feedbackActivityCreatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setMessage(
        isArabic
          ? 'تم تحديث مرحلة الصفقة بنجاح.'
          : 'Deal stage updated successfully.'
      );
    } catch (stageError) {
      console.error(stageError);
      setError(
        isArabic
          ? 'حدث خطأ أثناء تحديث مرحلة الصفقة.'
          : 'Failed to update deal stage.'
      );
    }
  };

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="space-y-7">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          <BriefcaseBusiness className="h-4 w-4" />
          {isArabic ? 'لوحة كانبان للصفقات المقبولة' : 'Accepted Deals Kanban'}
        </div>

        <h1 className="mt-4 text-3xl font-black text-gray-950">
          {isArabic
            ? 'إدارة الصفقات بعد موافقة العميل'
            : 'Manage Deals After Client Approval'}
        </h1>

        <p className="mt-2 text-gray-500">
          {isArabic
            ? 'الصفقات الجديدة لا تظهر هنا ولا تدخل المهام حتى يوافق عليها العميل أولاً. بعد الموافقة يتم إنشاء مهمة تلقائياً ويمكن تحريك الصفقة بين المراحل.'
            : 'New deals stay hidden here until the client approves them. After approval, an activity is created automatically and the deal can be moved between stages.'}
        </p>
      </div>

      {message && (
        <Feedback tone="blue" message={message} onClose={() => setMessage('')} />
      )}

      {error && (
        <Feedback tone="red" message={error} onClose={() => setError('')} />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniStat
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={isArabic ? 'صفقات مقبولة' : 'Accepted Deals'}
          value={acceptedDeals.length}
        />
        <MiniStat
          icon={<Clock3 className="h-5 w-5" />}
          label={isArabic ? 'بانتظار موافقة العميل' : 'Waiting Client Approval'}
          value={pendingApprovalCount}
        />
        <MiniStat
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label={isArabic ? 'المعروضة حالياً' : 'Currently Shown'}
          value={filteredDeals.length}
        />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <div className="relative">
            <Search
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${
                isArabic ? 'right-4' : 'left-4'
              }`}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isArabic
                  ? 'بحث عن صفقة، عميل، خدمة...'
                  : 'Search deal, client, service...'
              }
              className={`w-full rounded-2xl border border-gray-200 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                isArabic ? 'pr-11 pl-4' : 'pl-11 pr-4'
              }`}
            />
          </div>

          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">
              {isArabic ? 'كل خطوط الأنابيب' : 'All pipelines'}
            </option>

            {pipelines.map((pipeline) => (
              <option key={pipeline} value={pipeline}>
                {pipeline}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">
              {isArabic ? 'كل الأولويات' : 'All priorities'}
            </option>

            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {localizedPriority(priority, isArabic)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading && (
        <p className="rounded-2xl bg-blue-50 p-5 text-center font-bold text-blue-700">
          {isArabic ? 'جاري تحميل الصفقات...' : 'Loading deals...'}
        </p>
      )}

      {!loading && acceptedDeals.length === 0 && (
        <Card>
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-black text-gray-800">
              {isArabic ? 'لا توجد صفقات مقبولة حالياً' : 'No accepted deals yet'}
            </h3>
            <p className="mt-2 text-sm font-bold text-gray-500">
              {isArabic
                ? 'أضف صفقة من صفحة الصفقات، سيتم إرسال بريد للعميل، وبعد موافقته ستظهر هنا وتدخل إلى المهام.'
                : 'Create a deal from the Deals page, the client will receive an email, and after approval it will appear here and enter Activities.'}
            </p>
          </div>
        </Card>
      )}

      {!loading && acceptedDeals.length > 0 && filteredDeals.length === 0 && (
        <Card>
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm font-bold text-gray-500">
            {isArabic
              ? 'لا توجد صفقات مطابقة للفلاتر الحالية.'
              : 'No deals match the current filters.'}
          </div>
        </Card>
      )}

      {!loading && filteredDeals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleStages.map((stage) => {
            const stageDeals = dealsByStage[stage] || [];
            const totalValue = stageDeals.reduce(
              (sum, deal) => sum + Number(deal.dealValue || 0),
              0
            );
            const currency = stageDeals[0]?.currency || 'DZD';

            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedDealId) {
                    updateDealStage(draggedDealId, stage);
                  }

                  setDraggedDealId(null);
                }}
                className="rounded-3xl border border-gray-100 bg-gray-50 p-3"
              >
                <div className="mb-3 rounded-2xl bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-black text-gray-950">
                        {stage}
                      </h2>

                      <p className="mt-1 text-[11px] font-bold text-gray-500">
                        {stageDeals.length} {isArabic ? 'صفقة' : 'deals'}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">
                      {formatMoney(totalValue, currency)}
                    </span>
                  </div>
                </div>

                <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                  {stageDeals.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-center text-xs font-bold text-gray-400">
                      {isArabic ? 'اسحب صفقة هنا' : 'Drop a deal here'}
                    </div>
                  )}

                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggedDealId(deal.id)}
                      onDragEnd={() => setDraggedDealId(null)}
                      className="cursor-grab rounded-2xl border border-gray-100 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black text-gray-950">
                            {getDealTitle(deal)}
                          </h3>

                          <p className="mt-1 truncate text-xs font-bold text-gray-500">
                            {getClientName(deal)}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${priorityTone(
                            deal.priority
                          )}`}
                        >
                          {localizedPriority(deal.priority, isArabic)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <Info
                          label={isArabic ? 'القيمة' : 'Value'}
                          value={formatMoney(
                            Number(deal.dealValue || 0),
                            deal.currency
                          )}
                        />

                        <Info
                          label={isArabic ? 'الاحتمال' : 'Probability'}
                          value={`${Number(deal.probability || 0)}%`}
                        />

                        <Info
                          label={isArabic ? 'المسؤول' : 'Owner'}
                          value={deal.owner || '-'}
                        />

                        <Info
                          label={isArabic ? 'القسم' : 'Department'}
                          value={deal.department || '-'}
                        />
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-[10px] font-black text-gray-400">
                          {isArabic ? 'تغيير المرحلة' : 'Change stage'}
                        </label>
                        <select
                          value={deal.stage || DEFAULT_STAGE}
                          onChange={(e) => updateDealStage(deal.id, e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {allStageOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      {deal.nextAction && (
                        <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700">
                          {deal.nextAction}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-2">
      <p className="truncate text-[10px] font-bold text-gray-400">
        {label}
      </p>
      <p className="mt-1 truncate text-[11px] font-black text-gray-900">
        {value}
      </p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 text-blue-700">
        <div className="rounded-2xl bg-blue-50 p-2">{icon}</div>
        <p className="text-sm font-black text-gray-500">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-black text-gray-950">{value}</p>
    </div>
  );
}

function Feedback({ tone, message, onClose }: { tone: 'blue' | 'red'; message: string; onClose: () => void }) {
  const cls =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-red-200 bg-red-50 text-red-700';

  return (
    <div className={`rounded-2xl border px-5 py-4 font-bold ${cls}`}>
      <div className="flex items-start justify-between gap-4">
        <p>{message}</p>
        <button onClick={onClose}>×</button>
      </div>
    </div>
  );
}
