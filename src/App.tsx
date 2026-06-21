import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './auth/AuthContext';

import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
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

import { AdminOverview } from './pages/AdminOverview';
import { Activities } from './pages/Activities';
import { ActiveServices } from './pages/ActiveServices';
import { DealsKanban } from './pages/DealsKanban';

type AdminRole = 'admin' | 'super_admin' | 'department_head' | 'owner';
type AppRole = AdminRole | 'client';

const adminRoles: AdminRole[] = [
  'admin',
  'super_admin',
  'department_head',
  'owner',
];

const allAdminRoles: AdminRole[] = [
  'admin',
  'super_admin',
  'department_head',
  'owner',
];

const superAdminOnly: AdminRole[] = [
  'admin',
  'super_admin',
];

const departmentManagementRoles: AdminRole[] = [
  'admin',
  'super_admin',
  'department_head',
];

const operationalRoles: AdminRole[] = [
  'admin',
  'super_admin',
  'department_head',
  'owner',
];

type ProtectedRouteProps = {
  allowedRoles: AppRole[];
  children: React.ReactNode;
};

const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <p className="text-gray-500">جاري التحميل...</p>
  </div>
);

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!role || !allowedRoles.includes(role as AppRole)) {
    const isAdminUser =
      role !== null && adminRoles.includes(role as AdminRole);

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

const LoginRoute = () => {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const isAdminUser =
    role !== null && adminRoles.includes(role as AdminRole);

  if (isAdminUser) {
    return <Navigate to="/" replace />;
  }

  if (role === 'client') {
    return <Navigate to="/client" replace />;
  }

  return <Login />;
};

const AdminPage = ({
  allowedRoles,
  children,
}: {
  allowedRoles: AdminRole[];
  children: React.ReactNode;
}) => {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
};

const ClientPage = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProtectedRoute allowedRoles={['client']}>
      {children}
    </ProtectedRoute>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route
        path="/"
        element={
          <AdminPage allowedRoles={allAdminRoles}>
            <AdminOverview />
          </AdminPage>
        }
      />

      <Route
        path="/overview"
        element={
          <AdminPage allowedRoles={allAdminRoles}>
            <AdminOverview />
          </AdminPage>
        }
      />

      <Route
        path="/home"
        element={
          <AdminPage allowedRoles={superAdminOnly}>
            <Home />
          </AdminPage>
        }
      />

      <Route
        path="/account-requests"
        element={
          <AdminPage allowedRoles={superAdminOnly}>
            <AccountRequests />
          </AdminPage>
        }
      />

      <Route
        path="/clients"
        element={
          <AdminPage allowedRoles={superAdminOnly}>
            <Clients />
          </AdminPage>
        }
      />

      <Route
        path="/deals"
        element={
          <AdminPage allowedRoles={departmentManagementRoles}>
            <Deals />
          </AdminPage>
        }
      />

      <Route
        path="/deals-kanban"
        element={
          <AdminPage allowedRoles={operationalRoles}>
            <DealsKanban />
          </AdminPage>
        }
      />

      <Route
        path="/service-requests"
        element={
          <AdminPage allowedRoles={departmentManagementRoles}>
            <ServiceRequests />
          </AdminPage>
        }
      />

      <Route
        path="/current-services"
        element={
          <AdminPage allowedRoles={superAdminOnly}>
            <CurrentServices />
          </AdminPage>
        }
      />

      <Route
        path="/active-services"
        element={
          <AdminPage allowedRoles={operationalRoles}>
            <ActiveServices />
          </AdminPage>
        }
      />

      <Route
        path="/activities"
        element={
          <AdminPage allowedRoles={operationalRoles}>
            <Activities />
          </AdminPage>
        }
      />

      <Route
        path="/invoices"
        element={
          <AdminPage allowedRoles={superAdminOnly}>
            <Invoices />
          </AdminPage>
        }
      />

      <Route
        path="/client"
        element={
          <ClientPage>
            <ClientLayout />
          </ClientPage>
        }
      >
        <Route index element={<ClientOverview />} />
        <Route path="request-service" element={<ClientRequestService />} />
        <Route path="services" element={<ClientServices />} />
        <Route path="invoices" element={<ClientInvoices />} />
        <Route path="deals" element={<ClientDeals />} />
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
