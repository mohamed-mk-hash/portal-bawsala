import React, { useState } from 'react';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type Props = {
  onClose: () => void;
};

export const ChangePasswordModal: React.FC<Props> = ({ onClose }) => {
  const { user, profile, updateProfile } = useAuth();
  const { isArabic } = useLanguage();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setSuccess('');
      setLoading(true);

      if (!user || !user.email) {
        setError(
          isArabic
            ? 'لم يتم العثور على المستخدم الحالي.'
            : 'Current user was not found.'
        );
        return;
      }

      if (newPassword.length < 6) {
        setError(
          isArabic
            ? 'كلمة المرور الجديدة يجب أن تحتوي على 6 أحرف على الأقل.'
            : 'New password must be at least 6 characters.'
        );
        return;
      }

      if (newPassword !== confirmPassword) {
        setError(
          isArabic
            ? 'كلمة المرور الجديدة غير متطابقة.'
            : 'New password confirmation does not match.'
        );
        return;
      }

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false,
      });

      updateProfile({
  mustChangePassword: false,
});

      setSuccess(
        isArabic
          ? 'تم تغيير كلمة المرور بنجاح.'
          : 'Password changed successfully.'
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      console.error(error);

      setError(
        isArabic
          ? 'كلمة المرور الحالية غير صحيحة أو حدث خطأ أثناء التغيير.'
          : 'Current password is incorrect or something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isArabic ? 'تغيير كلمة المرور' : 'Change Password'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {isArabic
                ? 'أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة.'
                : 'Enter your current password and your new password.'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {profile?.mustChangePassword && (
          <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm font-medium text-yellow-800">
            {isArabic
              ? 'أنت تستعمل كلمة مرور مؤقتة. يرجى تغييرها لحماية حسابك.'
              : 'You are using a temporary password. Please change it to secure your account.'}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {isArabic ? 'كلمة المرور الحالية' : 'Current password'}
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {isArabic ? 'كلمة المرور الجديدة' : 'New password'}
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {isArabic
                ? 'تأكيد كلمة المرور الجديدة'
                : 'Confirm new password'}
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-900 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {loading
              ? isArabic
                ? 'جاري التغيير...'
                : 'Changing...'
              : isArabic
              ? 'تغيير كلمة المرور'
              : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
};