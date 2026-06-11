import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

type Role = 'admin' | 'client';

type ProtectedRouteProps = {
  allowedRoles: Role[];
  children: React.ReactNode;
};

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

  if (!allowedRoles.includes(role)) {
    if (role === 'admin') {
      return <Navigate to="/" replace />;
    }

    if (role === 'client') {
      return <Navigate to="/client" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};