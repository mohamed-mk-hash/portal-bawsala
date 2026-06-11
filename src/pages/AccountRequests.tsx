import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../components/Card';
import { db } from '../firebase';
import { useLanguage } from '../i18n/LanguageContext';

type AccessRequest = {
  id: string;
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  status: 'pending' | 'accepted' | 'refused';
  createdAt?: Timestamp;
  refusalReason?: string;
};

const refusalReasons = [
  'المعلومات غير مكتملة',
  'البريد الإلكتروني غير صحيح',
  'الخدمة غير متاحة حالياً',
  'الطلب لا يناسب شروط الشركة',
];

export const AccountRequests: React.FC = () => {
  const { isArabic } = useLanguage();

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReason, setSelectedReason] = useState(refusalReasons[0]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [dashboardError, setDashboardError] = useState('');
const [dashboardSuccess, setDashboardSuccess] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'accessRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as AccessRequest[];

      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sendEmail = async ({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }) => {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mailer-secret': 'very_strong_secret',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      throw new Error('Email failed');
    }
  };

const acceptRequest = async (request: AccessRequest) => {
  try {
    setProcessingId(request.id);
    setDashboardError('');
    setDashboardSuccess('');

    const response = await fetch('/api/accept-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mailer-secret': 'very_strong_secret',
      },
      body: JSON.stringify({
        requestId: request.id,
        companyName: request.companyName,
        fullName: request.fullName,
        email: request.email,
        phone: request.phone,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data.error === 'This email already has an account'
          ? isArabic
            ? 'هذا البريد الإلكتروني لديه حساب بالفعل.'
            : 'This email already has an account.'
          : data.error === 'Request already accepted'
          ? isArabic
            ? 'تم قبول هذا الطلب من قبل.'
            : 'This request was already accepted.'
          : data.error === 'Request not found'
          ? isArabic
            ? 'لم يتم العثور على هذا الطلب.'
            : 'Request not found.'
          : data.error === 'Missing fields'
          ? isArabic
            ? 'بعض معلومات الطلب ناقصة.'
            : 'Some request information is missing.'
          : isArabic
          ? 'حدث خطأ أثناء قبول الطلب.'
          : 'Accept request failed.';

      setDashboardError(message);
      return;
    }

    setDashboardSuccess(
      isArabic
        ? 'تم قبول الطلب وإنشاء الحساب وإرسال بيانات الدخول بنجاح.'
        : 'Request accepted, account created, and login details sent successfully.'
    );
  } catch (error) {
    console.error(error);

    setDashboardError(
      isArabic
        ? 'تعذر الاتصال بالسيرفر. تأكد أن mailer server يعمل على المنفذ 4000.'
        : 'Could not connect to the server. Make sure the mailer server is running on port 4000.'
    );
  } finally {
    setProcessingId(null);
  }
};

  const refuseRequest = async (request: AccessRequest) => {
    try {
      setProcessingId(request.id);

      await updateDoc(doc(db, 'accessRequests', request.id), {
        status: 'refused',
        refusalReason: selectedReason,
        refusedAt: new Date(),
      });

      await sendEmail({
        to: request.email,
        subject: 'Bawsala Dashboard Request Refused',
        html: `
          <div style="font-family: Arial; padding: 24px; line-height: 1.8;">
            <h2>تم رفض طلبك</h2>
            <p>مرحباً ${request.fullName}</p>
            <p>نعتذر، تم رفض طلبك للحصول على لوحة تحكم خاصة.</p>
            <p><strong>سبب الرفض:</strong> ${selectedReason}</p>
            <br />
            <p>فريق بوصلة</p>
          </div>
        `,
      });

      alert(isArabic ? 'تم رفض الطلب وإرسال الإيميل' : 'Request refused and email sent');
    } catch (error) {
      console.error(error);
      alert(isArabic ? 'حدث خطأ أثناء رفض الطلب' : 'Refuse failed');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const acceptedCount = requests.filter((r) => r.status === 'accepted').length;
  const refusedCount = requests.filter((r) => r.status === 'refused').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {isArabic ? 'طلبات الحسابات' : 'Account Requests'}
      </h1>

      {dashboardError && (
  <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 font-medium">
    <div className="flex items-start justify-between gap-4">
      <p>{dashboardError}</p>

      <button
        onClick={() => setDashboardError('')}
        className="text-red-500 hover:text-red-700 font-bold"
      >
        ×
      </button>
    </div>
  </div>
)}

{dashboardSuccess && (
  <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-green-700 font-medium">
    <div className="flex items-start justify-between gap-4">
      <p>{dashboardSuccess}</p>

      <button
        onClick={() => setDashboardSuccess('')}
        className="text-green-500 hover:text-green-700 font-bold"
      >
        ×
      </button>
    </div>
  </div>
)}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <p className="text-sm text-gray-600">
            {isArabic ? 'كل الطلبات' : 'All Requests'}
          </p>
          <p className="text-3xl font-bold mt-2">{requests.length}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-600">
            {isArabic ? 'قيد المراجعة' : 'Pending'}
          </p>
          <p className="text-3xl font-bold mt-2">{pendingCount}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-600">
            {isArabic ? 'مقبولة' : 'Accepted'}
          </p>
          <p className="text-3xl font-bold mt-2">{acceptedCount}</p>
        </Card>

        <Card>
          <p className="text-sm text-gray-600">
            {isArabic ? 'مرفوضة' : 'Refused'}
          </p>
          <p className="text-3xl font-bold mt-2">{refusedCount}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-6">
          {isArabic ? 'أحدث طلبات الحسابات' : 'Latest Account Requests'}
        </h2>

        {loading && (
          <p className="text-center py-8 text-gray-500">
            {isArabic ? 'جاري تحميل الطلبات...' : 'Loading requests...'}
          </p>
        )}

        {!loading && requests.length === 0 && (
          <p className="text-center py-8 text-gray-500">
            {isArabic ? 'لا توجد طلبات حالياً.' : 'No requests yet.'}
          </p>
        )}

        {!loading && requests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'الشركة' : 'Company'}
                  </th>
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'العميل' : 'Client'}
                  </th>
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'البريد الإلكتروني' : 'Email'}
                  </th>
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'الهاتف' : 'Phone'}
                  </th>
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'الحالة' : 'Status'}
                  </th>
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'التاريخ' : 'Date'}
                  </th>
                  <th className="text-start py-3 px-4 font-medium">
                    {isArabic ? 'الإجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>

              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-gray-200">
                    <td className="py-3 px-4 font-medium">
                      {request.companyName}
                    </td>

                    <td className="py-3 px-4">{request.fullName}</td>

                    <td className="py-3 px-4">{request.email}</td>

                    <td className="py-3 px-4">{request.phone}</td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          request.status === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : request.status === 'refused'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {request.status === 'accepted'
                          ? isArabic
                            ? 'مقبول'
                            : 'Accepted'
                          : request.status === 'refused'
                          ? isArabic
                            ? 'مرفوض'
                            : 'Refused'
                          : isArabic
                          ? 'قيد الانتظار'
                          : 'Pending'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {request.createdAt
                        ? request.createdAt
                            .toDate()
                            .toLocaleDateString(isArabic ? 'ar-DZ' : 'en-US')
                        : '-'}
                    </td>

                    <td className="py-3 px-4">
                      {request.status === 'pending' ? (
                        <div className="flex flex-col gap-2 min-w-48">
                          <button
                            onClick={() => acceptRequest(request)}
                            disabled={processingId === request.id}
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {processingId === request.id
                              ? isArabic
                                ? 'جاري...'
                                : 'Loading...'
                              : isArabic
                              ? 'قبول'
                              : 'Accept'}
                          </button>

                          <select
                            value={selectedReason}
                            onChange={(e) => setSelectedReason(e.target.value)}
                            className="border rounded-lg px-3 py-2 text-xs"
                          >
                            {refusalReasons.map((reason) => (
                              <option key={reason} value={reason}>
                                {reason}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => refuseRequest(request)}
                            disabled={processingId === request.id}
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            {processingId === request.id
                              ? isArabic
                                ? 'جاري...'
                                : 'Loading...'
                              : isArabic
                              ? 'رفض'
                              : 'Refuse'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">
                          {isArabic ? 'تمت المعالجة' : 'Processed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-6">
          {isArabic ? 'تفاصيل آخر طلب' : 'Latest Request Details'}
        </h2>

        {requests[0] ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Detail
              label={isArabic ? 'الشركة' : 'Company'}
              value={requests[0].companyName}
            />

            <Detail
              label={isArabic ? 'العميل' : 'Client'}
              value={requests[0].fullName}
            />

            <Detail
              label={isArabic ? 'البريد الإلكتروني' : 'Email'}
              value={requests[0].email}
            />

            <Detail
              label={isArabic ? 'الهاتف' : 'Phone'}
              value={requests[0].phone}
            />

            <div className="lg:col-span-2">
              <p className="text-sm text-gray-600">
                {isArabic ? 'تفاصيل الطلب' : 'Request Details'}
              </p>
              <p className="font-medium mt-2 leading-8">
                {requests[0].message}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">
            {isArabic ? 'لا توجد طلبات حالياً.' : 'No requests yet.'}
          </p>
        )}
      </Card>
    </div>
  );
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}