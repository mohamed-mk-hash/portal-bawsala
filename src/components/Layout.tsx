import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useLanguage } from '../i18n/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isArabic } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Navbar />
      <main className={`${isArabic ? 'mr-64' : 'ml-64'} pt-16`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};