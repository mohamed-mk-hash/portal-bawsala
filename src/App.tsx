import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './auth/AuthContext';

import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { AccountRequests } from './pages/AccountRequests';
import { ServiceRequests } from './pages/ServiceRequests';
import { CurrentServices } from './pages/CurrentServices';
import { Invoices } from './pages/Invoices';

import { ClientLayout } from './client/ClientLayout';
import { ClientOverview } from './client/ClientOverview';
import { ClientServices } from './client/ClientServices';
import { ClientInvoices } from './client/ClientInvoices';
import { ClientRequestService } from './client/ClientRequestService';

type ProtectedRouteProps = {
  allowedRole: 'admin' | 'client';
  children: React.ReactNode;
};

const ProtectedRoute = ({ allowedRole, children }: ProtectedRouteProps) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role !== allowedRole) {
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

const LoginRoute = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (role === 'admin') {
    return <Navigate to="/" replace />;
  }

  if (role === 'client') {
    return <Navigate to="/client" replace />;
  }

  return <Login />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      {/* Admin routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute allowedRole="admin">
            <Layout>
              <Overview />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/home"
        element={
          <ProtectedRoute allowedRole="admin">
            <Layout>
              <Home />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/account-requests"
        element={
          <ProtectedRoute allowedRole="admin">
            <Layout>
              <AccountRequests />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
  path="/service-requests"
  element={
    <ProtectedRoute allowedRole="admin">
      <Layout>
        <ServiceRequests />
      </Layout>
    </ProtectedRoute>
  }
/>

<Route
  path="/invoices"
  element={
    <ProtectedRoute allowedRole="admin">
      <Layout>
        <Invoices />
      </Layout>
    </ProtectedRoute>
  }
/>

<Route
  path="/current-services"
  element={
    <ProtectedRoute allowedRole="admin">
      <Layout>
        <CurrentServices />
      </Layout>
    </ProtectedRoute>
  }
/>

      {/* Client routes */}
      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRole="client">
            <ClientLayout />
          </ProtectedRoute>
        }
      >
         <Route path="request-service" element={<ClientRequestService />} />
        <Route index element={<ClientOverview />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="invoices" element={<ClientInvoices />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;