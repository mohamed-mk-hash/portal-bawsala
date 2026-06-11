import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { isArabic } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);

      const role = await login(email, password);

      if (role === 'admin') {
        navigate('/', { replace: true });
        return;
      }

      if (role === 'client') {
        navigate('/client', { replace: true });
        return;
      }

      setError(isArabic ? 'نوع الحساب غير معروف.' : 'Unknown account role.');
    } catch (error) {
      console.error(error);

      setError(
        isArabic
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : 'Invalid email or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gray-50 flex items-center justify-center p-6"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-900 flex items-center justify-center text-white mb-4">
            <Lock className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            {isArabic ? 'تسجيل الدخول' : 'Login'}
          </h1>

          <p className="text-gray-500 mt-2">
            {isArabic
              ? 'أدخل بيانات حسابك للوصول إلى لوحة التحكم'
              : 'Enter your account details to access your dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isArabic ? 'البريد الإلكتروني' : 'Email'}
          </label>

          <div className="flex items-center gap-3 border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <Mail className="w-5 h-5 text-gray-400" />

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full outline-none bg-transparent"
              required
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isArabic ? 'كلمة المرور' : 'Password'}
          </label>

          <div className="flex items-center gap-3 border border-gray-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500">
            <Lock className="w-5 h-5 text-gray-400" />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full outline-none bg-transparent"
              required
            />
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-colors disabled:opacity-60"
        >
          {loading
            ? isArabic
              ? 'جاري الدخول...'
              : 'Logging in...'
            : isArabic
            ? 'دخول'
            : 'Login'}
        </button>
      </form>
    </div>
  );
};