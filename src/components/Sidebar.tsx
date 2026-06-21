import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Users,
  CheckSquare,
  Columns3,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';

export const Sidebar: React.FC = () => {
  const { t, isArabic } = useLanguage();
  const { logout, profile } = useAuth();

const role = profile?.role;

  const menuItems = [
  {
    path: '/',
    label: isArabic ? 'لوحة القيادة' : 'Overview',
    icon: LayoutDashboard,
    roles: ['admin', 'super_admin', 'department_head', 'owner'],
  },

  {
    path: '/account-requests',
    label: isArabic ? 'طلبات الحسابات' : 'Account Requests',
    icon: Users,
    roles: ['admin', 'super_admin'],
  },

  {
    path: '/clients',
    label: isArabic ? 'العملاء' : 'Clients',
    icon: Building2,
    roles: ['admin', 'super_admin'],
  },

  {
    path: '/deals',
    label: isArabic ? 'الصفقات' : 'Deals',
    icon: BriefcaseBusiness,
    roles: ['admin', 'super_admin', 'department_head'],
  },

  {
    path: '/deals-kanban',
    label: isArabic ? 'كانبان الصفقات' : 'Deals Kanban',
    icon: Columns3,
    roles: ['admin', 'super_admin', 'department_head', 'owner'],
  },

  {
    path: '/service-requests',
    label: isArabic ? 'طلبات الخدمة' : 'Service Requests',
    icon: ClipboardList,
    roles: ['admin', 'super_admin', 'department_head'],
  },

  {
    path: '/current-services',
    label: isArabic ? 'كتالوج الخدمات' : 'Service Catalog',
    icon: ClipboardList,
    roles: ['admin', 'super_admin'],
  },

  {
    path: '/active-services',
    label: isArabic ? 'الخدمات الجارية' : 'Active Services',
    icon: ClipboardList,
    roles: ['admin', 'super_admin', 'department_head', 'owner'],
  },

  {
    path: '/activities',
    label: isArabic ? 'المهام' : 'Activities',
    icon: CheckSquare,
    roles: ['admin', 'super_admin', 'department_head', 'owner'],
  },

  {
    path: '/invoices',
    label: isArabic ? 'الفواتير' : 'Invoices',
    icon: ReceiptText,
    roles: ['admin', 'super_admin'],
  },
];

const visibleMenuItems = menuItems.filter((item) =>
  item.roles.includes(role || '')
);

  return (
    <div
      className={`w-64 bg-gray-900 text-white h-screen fixed top-0 z-40 ${
        isArabic ? 'right-0' : 'left-0'
      }`}
    >
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t.dashboard}</h1>
      </div>

      <nav className="mt-6">
        {visibleMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 hover:bg-gray-800 transition-colors ${
                isActive
                  ? isArabic
                    ? 'bg-gray-800 border-r-4 border-blue-500'
                    : 'bg-gray-800 border-l-4 border-blue-500'
                  : ''
              }`
            }
          >
            <item.icon className={`w-5 h-5 ${isArabic ? 'ml-3' : 'mr-3'}`} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className={`absolute bottom-6 ${
          isArabic ? 'right-0' : 'left-0'
        } w-full flex items-center px-6 py-3 hover:bg-gray-800 transition-colors text-red-300`}
      >
        <LogOut className={`w-5 h-5 ${isArabic ? 'ml-3' : 'mr-3'}`} />
        <span>{isArabic ? 'تسجيل الخروج' : 'Logout'}</span>
      </button>
    </div>
  );
};
