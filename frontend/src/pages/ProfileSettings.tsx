import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Seo from "../components/Seo";
import { useTheme } from "../ThemeContext"; // Импорт контекста темы
// Иконки
import {
  User,
  Mail,
  Calendar,
  Edit,
  Save,
  X,
  Upload,
  Trash2,
  BarChart3,
  Vote,
  ArrowLeft,
  Moon,
  Sun,
} from "lucide-react";

interface ProfileData {
  id: number;
  email: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  polls_created: number;
  votes_count: number;
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme(); // Хук темы

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get<ProfileData>("/profile");
      setProfile(response.data);
      setFormData({
        full_name: response.data.full_name || "",
        bio: response.data.bio || "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (formData.password && formData.password !== formData.confirmPassword) {
      alert("Пароли не совпадают");
      return;
    }

    setSaving(true);
    try {
      const updateData: {
        full_name: string | null;
        bio: string | null;
        password?: string;
      } = {
        full_name: formData.full_name || null,
        bio: formData.bio || null,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      await api.put("/profile", updateData);
      await loadProfile();
      setIsEditing(false);
      alert("Профиль успешно обновлен!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Ошибка при обновлении профиля");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Пожалуйста, выберите изображение");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Размер файла не должен превышать 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      await api.post("/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadProfile();
      alert("Аватар успешно загружен!");
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      alert("Ошибка при загрузке аватарки");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm("Удалить аватарку?")) return;

    try {
      await api.delete("/profile/avatar");
      await loadProfile();
      alert("Аватарка удалена");
    } catch (error) {
      console.error("Failed to delete avatar:", error);
      alert("Ошибка при удалении аватарки");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 dark:text-gray-400">
          Загрузка профиля...
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Не удалось загрузить профиль
        </p>
      </div>
    );
  }

  return (
    <>
      <Seo
        title="Настройки профиля"
        description="Управление настройками профиля, аватаром и личной информацией."
        canonicalUrl="/app/profile"
        noindex
        nofollow
      />
      <main className="max-w-4xl mx-auto">
        {/* Шапка */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              Настройки профиля
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ЛЕВАЯ КОЛОНКА */}
          <div className="lg:col-span-1 space-y-6">
            {/* Карточка фото */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors">
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Аватар"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-600">
                        <User
                          size={48}
                          className="text-indigo-400 dark:text-gray-400"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 mt-4 items-center w-full">
                    <label className="cursor-pointer bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 w-full max-w-xs justify-center shadow-md shadow-indigo-500/20">
                      <Upload size={18} />
                      Загрузить фото
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                      />
                    </label>

                    {profile.avatar_url && (
                      <button
                        onClick={handleDeleteAvatar}
                        disabled={uploading}
                        className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-6 py-3 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 transition flex items-center gap-2 w-full max-w-xs justify-center"
                      >
                        <Trash2 size={18} />
                        Удалить фото
                      </button>
                    )}
                  </div>

                  {uploading && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Загрузка...
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-800 dark:text-white text-center">
                  {profile.full_name || "Без имени"}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center mt-1">
                  {profile.email}
                </p>
              </div>

              <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                  <Calendar size={18} />
                  <span className="text-sm">
                    Участник с{" "}
                    {new Date(profile.created_at).toLocaleDateString("ru-RU")}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                  <BarChart3 size={18} />
                  <span className="text-sm">
                    Создано опросов: {profile.polls_created}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                  <Vote size={18} />
                  <span className="text-sm">
                    Отдано голосов: {profile.votes_count}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА */}
          <div className="lg:col-span-2 space-y-6">
            {/* Карточка переключения темы */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center justify-between transition-colors">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  Оформление
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Выберите тему интерфейса
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
              >
                {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                <span>{theme === "dark" ? "Темная" : "Светлая"}</span>
              </button>
            </div>

            {/* Карточка редактирования */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {isEditing
                    ? "Редактирование профиля"
                    : "Информация о профиле"}
                </h2>

                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium transition"
                  >
                    <Edit size={18} />
                    Редактировать
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          full_name: profile.full_name || "",
                          bio: profile.bio || "",
                          password: "",
                          confirmPassword: "",
                        });
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <X size={18} />
                      Отмена
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail size={16} />
                      Email адрес
                    </div>
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                    Email нельзя изменить
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Полное имя
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
                    placeholder="Введите ваше имя"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    О себе
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-500"
                    placeholder="Расскажите немного о себе..."
                  />
                </div>

                {isEditing && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                      Смена пароля
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Новый пароль
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          placeholder="Оставьте пустым, если не хотите менять"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Подтверждение пароля
                        </label>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                          placeholder="Повторите новый пароль"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Активность */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 transition-colors">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Активность
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-lg border border-blue-100 dark:border-blue-800/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                      <BarChart3
                        size={20}
                        className="text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                      Созданные опросы
                    </h4>
                  </div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    {profile.polls_created}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Всего создано опросов
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-5 rounded-lg border border-green-100 dark:border-green-800/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <Vote
                        size={20}
                        className="text-green-600 dark:text-green-400"
                      />
                    </div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">
                      Отданные голоса
                    </h4>
                  </div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    {profile.votes_count}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Участие в голосованиях
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
