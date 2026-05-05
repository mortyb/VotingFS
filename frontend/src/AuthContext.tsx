import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { clearClientSession, getClientAccessToken, setClientAccessToken } from './api';  // Для запросов к серверу
import type { AuthUser, Permission, UserRole } from './types';

// Описываем, какие данные и функции будут в контексте авторизации
interface AuthContextType {
  token: string | null;          // Токен доступа
  user: AuthUser | null;
  isLoadingUser: boolean;
  login: (email: string, pass: string) => Promise<void>;  // Функция входа
  logout: () => void;            // Функция выхода
  refreshUser: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  isAuthenticated: boolean;      // Флаг: авторизован ли пользователь
}

// Создаём контекст (глобальное хранилище для данных авторизации)
const AuthContext = createContext<AuthContextType | null>(null);

// Провайдер - оборачивает всё приложение и предоставляет данные авторизации
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Получаем токен из localStorage при запуске приложения
  const [token, setToken] = useState<string | null>(getClientAccessToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsLoadingUser(false);
      return;
    }

    setIsLoadingUser(true);
    try {
      const response = await api.get<AuthUser>('/auth/me');
      setUser(response.data);
    } catch {
      setUser(null);
      clearClientSession();
      setToken(null);
    } finally {
      setIsLoadingUser(false);
    }
  }, [token]);

  useEffect(() => {
    const bootstrapSession = async () => {
      if (!token) {
        try {
          const refreshResponse = await api.post('/auth/refresh');
          const newToken = refreshResponse.data.access_token as string;
          setClientAccessToken(newToken);
          setToken(newToken);
          return;
        } catch {
          setIsLoadingUser(false);
          return;
        }
      }

      await refreshUser();
    };

    bootstrapSession();
  }, [token, refreshUser]);

  // Функция входа
  const login = async (username: string, password: string) => {
    // Отправляем логин и пароль на сервер для получения токена
    const res = await api.post('/auth/login', { email: username, password });
    const newToken = res.data.access_token;  // Получаем токен из ответа
    
    // Сохраняем токен в состоянии и в localStorage браузера
    setClientAccessToken(newToken);
    setToken(newToken);
    await refreshUser();
  };

  // Функция выхода
  const logout = () => {
    api.post('/auth/logout').catch(() => undefined);
    // Удаляем токен из состояния и из localStorage
    clearClientSession();
    setToken(null);
    setUser(null);
    setIsLoadingUser(false);
  };

  const hasPermission = (permission: Permission) => {
    return !!user?.permissions?.includes(permission);
  };

  const hasRole = (role: UserRole) => {
    return user?.role === role;
  };

  // Предоставляем данные авторизации всем дочерним компонентам
  return (
    <AuthContext.Provider 
      value={{ 
        token, 
        user,
        isLoadingUser,
        login, 
        logout, 
        refreshUser,
        hasPermission,
        hasRole,
        isAuthenticated: !!token  // !!token превращает null/строку в true/false
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Хук для удобного доступа к данным авторизации
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
