import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'ar';

export const translations = {
  en: {
    dashboard: 'Dashboard',
    welcome: 'Welcome back!',
    languageButton: 'العربية',

    overview: 'Overview',
    orders: 'Orders',
    analytics: 'Analytics',
    settings: 'Settings',

    totalRevenue: 'Total Revenue',
    customers: 'Customers',
    avgOrder: 'Avg. Order',
    revenueOverview: 'Revenue Overview',
    recentOrders: 'Recent Orders',

    ordersPerMonth: 'Orders per Month',
    orderStatusDistribution: 'Order Status Distribution',

    orderId: 'Order ID',
    customer: 'Customer',
    product: 'Product',
    amount: 'Amount',
    status: 'Status',
    date: 'Date',

    completed: 'completed',
    processing: 'processing',
    pending: 'pending',
    cancelled: 'cancelled',

    completedChart: 'Completed',
    processingChart: 'Processing',
    pendingChart: 'Pending',
    cancelledChart: 'Cancelled',

    profileSettings: 'Profile Settings',
    name: 'Name',
    email: 'Email',
    saveChanges: 'Save Changes',
    notifications: 'Notifications',
    emailNotifications: 'Email notifications',
    pushNotifications: 'Push notifications',
    smsNotifications: 'SMS notifications',
  },

  ar: {
    dashboard: 'لوحة التحكم',
    welcome: 'مرحباً بعودتك!',
    languageButton: 'English',

    overview: 'نظرة عامة',
    orders: 'الطلبات',
    analytics: 'التحليلات',
    settings: 'الإعدادات',

    totalRevenue: 'إجمالي الإيرادات',
    customers: 'العملاء',
    avgOrder: 'متوسط الطلب',
    revenueOverview: 'نظرة عامة على الإيرادات',
    recentOrders: 'أحدث الطلبات',

    ordersPerMonth: 'الطلبات حسب الشهر',
    orderStatusDistribution: 'توزيع حالات الطلبات',

    orderId: 'رقم الطلب',
    customer: 'العميل',
    product: 'المنتج',
    amount: 'المبلغ',
    status: 'الحالة',
    date: 'التاريخ',

    completed: 'مكتمل',
    processing: 'قيد المعالجة',
    pending: 'قيد الانتظار',
    cancelled: 'ملغي',

    completedChart: 'مكتمل',
    processingChart: 'قيد المعالجة',
    pendingChart: 'قيد الانتظار',
    cancelledChart: 'ملغي',

    profileSettings: 'إعدادات الملف الشخصي',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    saveChanges: 'حفظ التغييرات',
    notifications: 'الإشعارات',
    emailNotifications: 'إشعارات البريد الإلكتروني',
    pushNotifications: 'الإشعارات الفورية',
    smsNotifications: 'إشعارات SMS',
  },
};

type Translation = typeof translations.en;

interface LanguageContextType {
  language: Language;
  isArabic: boolean;
  toggleLanguage: () => void;
  t: Translation;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const isArabic = language === 'ar';

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? 'rtl' : 'ltr';
  }, [language, isArabic]);

  return (
    <LanguageContext.Provider value={{ language, isArabic, toggleLanguage, t: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
};