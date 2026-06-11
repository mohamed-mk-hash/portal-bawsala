import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText ,
  Users,
  LogOut,
  ClipboardList ,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../auth/AuthContext';

export const Sidebar: React.FC = () => {
  const { t, isArabic } = useLanguage();
  const { logout } = useAuth();

  const menuItems = [
    { path: '/', label: t.overview, icon: LayoutDashboard }, 
    {
  path: '/account-requests',
  label: isArabic ? 'طلبات الحسابات' : 'Account Requests',
  icon: Users,
},
{
  label: isArabic ? 'طلبات الخدمة' : 'Service Requests',
  path: '/service-requests',
  icon: ClipboardList,
},
{
  label: isArabic ? 'الخدمات الحالية' : 'Current Services',
  path: '/current-services',
  icon: ClipboardList,
},

{
  label: isArabic ? 'الفواتبر' : 'Bills',
  path: '/invoices',
  icon: ReceiptText,
},

  ];

  return (
    <div
      className={`w-64 bg-gray-900 text-white h-screen fixed top-0 ${
        isArabic ? 'right-0' : 'left-0'
      }`}
    >
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t.dashboard}</h1>
      </div>

      <nav className="mt-6">
        {menuItems.map((item) => (
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