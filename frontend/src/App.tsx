import React from "react";
// Импортируем компоненты для маршрутизации (переключения страниц)
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// Импортируем систему авторизации
import { AuthProvider, useAuth } from "./AuthContext";

// Импортируем страницы нашего приложения
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import CreatePoll from "./pages/CreatePoll";
import PollDetail from "./pages/PollDetail";
import ProfileSettings from "./pages/ProfileSettings"; // Страница профиля
import Layout from "./Layout"; // Общий шаблон для защищённых страниц
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";
import type { Permission } from "./types";

// Компонент для защиты страниц - проверяет, авторизован ли пользователь
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoadingUser } = useAuth(); // Проверяем статус авторизации

  if (isLoadingUser) {
    return (
      <div className="p-6 text-center text-gray-500">Проверка доступа...</div>
    );
  }

  // Если авторизован - показываем страницу, если нет - перенаправляем на вход
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const PermissionRoute = ({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission: Permission;
}) => {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? children : <Navigate to="/app" />;
};

// Главный компонент приложения
export default function App() {
  return (
    // BrowserRouter - корневой компонент для маршрутизации
    <BrowserRouter>
      {/* AuthProvider - предоставляет данные авторизации всем компонентам */}
      <AuthProvider>
        {/* Routes - контейнер для всех маршрутов */}
        <Routes>
          {/* Публичные маршруты (доступны всем) */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Защищённые маршруты (только для авторизованных) */}
          {/* Layout - общий шаблон для всех защищённых страниц */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/app" element={<Dashboard />} />
            <Route
              path="/app/create"
              element={
                <PermissionRoute permission="poll:create">
                  <CreatePoll />
                </PermissionRoute>
              }
            />
            <Route path="/app/polls/:id" element={<PollDetail />} />
            <Route path="/app/profile" element={<ProfileSettings />} />
            <Route
              path="/app/admin/users"
              element={
                <PermissionRoute permission="user:manage_roles">
                  <AdminUsers />
                </PermissionRoute>
              }
            />
          </Route>

          {/* Резервный маршрут - если введён несуществующий адрес, показываем 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
