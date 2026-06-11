import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  KeyRound,
  Languages,
  UserCircle,
  XCircle,
} from 'lucide-react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ClientSidebar } from './ClientSidebar';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { db } from '../firebase';

type Notification = {
  id: string;
  clientId: string;
  type:
    | 'service_accepted'
    | 'service_refused'
    | 'service_status_updated'
    | 'invoice_created'
    | 'invoice_status_updated';
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  isRead: boolean;
  createdAt?: Timestamp;
};

export const ClientLayout: React.FC = () => {
  const { user, profile } = useAuth();
  const { isArabic, toggleLanguage } = useLanguage();

  const [showChangePassword, setShowChangePassword] = useState(
    !!profile?.mustChangePassword
  );

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [locallyReadIds, setLocallyReadIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('clientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Notification[];

      setNotifications(data);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadNotifications = notifications.filter(
    (item) => !item.isRead && !locallyReadIds.includes(item.id)
  );

  const unreadCount = unreadNotifications.length;

  const markAllAsRead = async () => {
    const unread = notifications.filter((item) => !item.isRead);

    setLocallyReadIds((current) => [
      ...new Set([...current, ...unread.map((item) => item.id)]),
    ]);

    await Promise.all(
      unread.map((item) =>
        updateDoc(doc(db, 'notifications', item.id), {
          isRead: true,
        })
      )
    );
  };

  const openNotifications = async () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);

    if (nextState && unreadCount > 0) {
      await markAllAsRead();
    }
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="h-screen overflow-hidden bg-gray-100 flex"
    >
      <ClientSidebar />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 h-16 bg-white border-b flex items-center justify-between px-6">
          <div>
            <h1 className="font-bold text-gray-900">
              {isArabic ? 'مرحباً' : 'Welcome'}, {profile?.fullName}
            </h1>
            <p className="text-sm text-gray-500">
              {profile?.companyName || 'Client Portal'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              <Languages className="h-4 w-4" />
              {isArabic ? 'English' : 'العربية'}
            </button>

            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <KeyRound className="h-4 w-4" />
              {isArabic ? 'كلمة المرور' : 'Password'}
            </button>

            <div className="relative">
              <button
                onClick={openNotifications}
                className="relative rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <Bell className="w-5 h-5" />

                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-black text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div
                  className={`absolute top-12 z-50 w-96 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl ${
                    isArabic ? 'left-0' : 'right-0'
                  }`}
                >
                  <div className="border-b border-gray-100 p-5">
                    <h3 className="text-lg font-black text-gray-900">
                      {isArabic ? 'الإشعارات' : 'Notifications'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {isArabic
                        ? 'آخر تحديثات طلباتك وخدماتك وفواتيرك.'
                        : 'Latest updates about your requests, services, and invoices.'}
                    </p>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-3">
                    {notifications.length === 0 && (
                      <p className="p-6 text-center text-sm text-gray-500">
                        {isArabic
                          ? 'لا توجد إشعارات حالياً.'
                          : 'No notifications yet.'}
                      </p>
                    )}

                    {notifications.map((notification) => {
                      const positive =
                        notification.type === 'service_accepted' ||
                        notification.type === 'service_status_updated' ||
                        notification.type === 'invoice_created' ||
                        notification.type === 'invoice_status_updated';

                      return (
                        <div
                          key={notification.id}
                          className="mb-2 rounded-2xl border border-gray-100 bg-gray-50 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`rounded-xl p-2 ${
                                positive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {positive ? (
                                <CheckCircle className="h-5 w-5" />
                              ) : (
                                <XCircle className="h-5 w-5" />
                              )}
                            </div>

                            <div>
                              <p className="font-bold text-gray-900">
                                {isArabic
                                  ? notification.titleAr
                                  : notification.titleEn}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-gray-600">
                                {isArabic
                                  ? notification.messageAr
                                  : notification.messageEn}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <UserCircle className="w-6 h-6" />
              <span className="text-sm font-medium">{profile?.email}</span>
            </div>
          </div>
        </header>

        {profile?.mustChangePassword && (
          <div className="mx-6 mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4 text-yellow-800">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium">
                {isArabic
                  ? 'أنت تستعمل كلمة مرور مؤقتة. يرجى تغييرها الآن لحماية حسابك.'
                  : 'You are using a temporary password. Please change it now to secure your account.'}
              </p>

              <button
                onClick={() => setShowChangePassword(true)}
                className="rounded-xl bg-yellow-600 px-4 py-2 text-sm font-bold text-white hover:bg-yellow-700"
              >
                {isArabic ? 'تغيير الآن' : 'Change now'}
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
};