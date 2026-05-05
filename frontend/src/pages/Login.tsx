import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate, Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      navigate("/app");
    } catch {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <main className="min-h-screen">
      <Seo
        title="Вход"
        description="Войдите в аккаунт PollMaster, чтобы просматривать, создавать и голосовать в опросах."
        canonicalUrl="/login"
        noindex
        nofollow
        ogType="website"
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-gray-900 dark:to-gray-800 p-4 transition-colors duration-500">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md transition-colors duration-300">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 text-center">
            Вход
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
            Добро пожаловать обратно!
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-200 transform active:scale-95 shadow-lg">
              Войти
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Нет аккаунта?{" "}
            <Link
              to="/register"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Зарегистрироваться
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
