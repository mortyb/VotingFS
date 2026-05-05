import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext";
import Seo from "../components/Seo";

interface ApiErrorShape {
  response?: {
    status?: number;
  };
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/register", { email, password });
      await login(email, password);
      navigate("/app");
    } catch (err: unknown) {
      const apiError = err as ApiErrorShape;
      if (apiError.response?.status === 400) {
        setError("Такой пользователь уже существует");
      } else {
        setError("Ошибка регистрации. Попробуйте позже.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-gray-900 dark:to-indigo-950 p-4 transition-colors duration-500">
      <Seo
        title="Регистрация"
        description="Создайте аккаунт в PollMaster, чтобы участвовать в голосованиях и создавать собственные опросы."
        canonicalUrl="/register"
        noindex
        nofollow
        ogType="website"
      />
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md transition-colors duration-300">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 text-center">
          Регистрация
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
          Создайте аккаунт, чтобы начать голосовать
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Пароль
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition duration-200 transform active:scale-95 shadow-lg">
            Создать аккаунт
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Уже есть аккаунт?{" "}
          <Link
            to="/login"
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
