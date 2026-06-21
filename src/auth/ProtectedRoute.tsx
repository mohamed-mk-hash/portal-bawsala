import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

type AdminRole = 'admin' | 'super_admin' | 'department_head' | 'owner';
type Role = AdminRole | 'client';

type ProtectedRouteProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
};

const adminRoles: AdminRole[] = [
  'admin',
  'super_admin',
  'department_head',
  'owner',
];

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { loading, isAuthenticated, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role as Role)) {
    const isAdminUser = adminRoles.includes(role as AdminRole);

    if (isAdminUser) {
      return <Navigate to="/" replace />;
    }

    if (role === 'client') {
      return <Navigate to="/client" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};