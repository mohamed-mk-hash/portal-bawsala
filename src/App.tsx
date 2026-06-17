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
import { Clients } from './pages/Clients';
import { Deals } from './pages/Deals';

import { ClientLayout } from './client/ClientLayout';
import { ClientOverview } from './client/ClientOverview';
import { ClientServices } from './client/ClientServices';
import { ClientInvoices } from './client/ClientInvoices';
import { ClientRequestService } from './client/ClientRequestService';
import { ClientDeals } from './client/ClientDeals';

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

const AdminPage = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProtectedRoute allowedRole="admin">
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route path="/" element={<AdminPage><Overview /></AdminPage>} />
      <Route path="/home" element={<AdminPage><Home /></AdminPage>} />
      <Route path="/account-requests" element={<AdminPage><AccountRequests /></AdminPage>} />
      <Route path="/clients" element={<AdminPage><Clients /></AdminPage>} />
      <Route path="/deals" element={<AdminPage><Deals /></AdminPage>} />
      <Route path="/service-requests" element={<AdminPage><ServiceRequests /></AdminPage>} />
      <Route path="/current-services" element={<AdminPage><CurrentServices /></AdminPage>} />
      <Route path="/invoices" element={<AdminPage><Invoices /></AdminPage>} />

      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRole="client">
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientOverview />} />
        <Route path="request-service" element={<ClientRequestService />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="invoices" element={<ClientInvoices />} />
        <Route path="/client/deals" element={<ClientDeals />} />
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
