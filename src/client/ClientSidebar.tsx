import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FileText,
  Grid2X2,
  LogOut,
  ReceiptText,
  Send,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export const ClientSidebar: React.FC = () => {
  const { logout } = useAuth();
  const { isArabic } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-white/70 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <aside className="w-64 bg-slate-950 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold">Bawsala</h1>
        <p className="text-sm text-white/50 mt-1">
          {isArabic ? 'بوابة العميل' : 'Client Portal'}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <NavLink to="/client" end className={linkClass}>
          <Grid2X2 className="w-5 h-5" />
          {isArabic ? 'نظرة عامة' : 'Overview'}
        </NavLink>

        <NavLink to="/client/request-service" className={linkClass}>
          <Send className="w-5 h-5" />
          {isArabic ? 'طلب خدمة' : 'Request Service'}
        </NavLink>

        <NavLink to="/client/services" className={linkClass}>
          <FileText className="w-5 h-5" />
          {isArabic ? 'خدماتي' : 'My Services'}
        </NavLink>

        <NavLink to="/client/invoices" className={linkClass}>
          <ReceiptText className="w-5 h-5" />
          {isArabic ? 'فواتيري' : 'My Invoices'}
        </NavLink>
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5" />
          {isArabic ? 'تسجيل الخروج' : 'Logout'}
        </button>
      </div>
    </aside>
  );
};