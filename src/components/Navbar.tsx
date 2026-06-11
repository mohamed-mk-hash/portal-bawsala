import React from 'react';
import { User, Bell, Languages } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export const Navbar: React.FC = () => {
  const { t, isArabic, toggleLanguage } = useLanguage();

  return (
    <div
      className={`h-16 bg-white shadow-sm border-b fixed top-0 ${
        isArabic ? 'right-64 left-0' : 'left-64 right-0'
      } z-10`}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t.welcome}</h2>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Languages className="w-4 h-4" />
            <span className="text-sm font-medium">{t.languageButton}</span>
          </button>

          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
          </button>

          <button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <User className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium">John Doe</span>
          </button>
        </div>
      </div>
    </div>
  );
};