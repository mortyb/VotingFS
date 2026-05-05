import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Plus, X, ArrowLeft, Image as ImageIcon, Tag } from "lucide-react";
import Seo from "../components/Seo";

export default function CreatePoll() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Общее"); // ✅ НОВОЕ: категория
  const [categories, setCategories] = useState<string[]>(["Общее"]); // ✅ НОВОЕ: список категорий
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [options, setOptions] = useState(["", ""]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false); // ✅ НОВОЕ: загрузка категорий

  // ✅ НОВОЕ: Загружаем список категорий при монтировании компонента
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await api.get("/categories");
      setCategories(response.data.categories || ["Общее"]);
    } catch (error) {
      console.error("Ошибка загрузки категорий:", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filledOptions = options.filter((o) => o.trim() !== "");
    if (filledOptions.length < 2) {
      alert("Минимум 2 варианта ответа");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    if (description) formData.append("description", description);
    formData.append("category", category); // ✅ НОВОЕ: добавляем категорию
    formData.append("is_anonymous", String(isAnonymous));
    const optionsArray = filledOptions.map((text) => ({ text }));
    formData.append("options_json", JSON.stringify(optionsArray));
    if (file) formData.append("file", file);

    try {
      await api.post("/polls", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate("/app");
    } catch (err) {
      console.error(err);
      alert("Ошибка при создании опроса");
    }
  };

  return (
    <>
      <Seo
        title="Создание опроса"
        description="Создайте новый опрос и настройте варианты ответов."
        canonicalUrl="/app/create"
        noindex
        nofollow
      />
      <div className="max-w-xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <ArrowLeft />
          </button>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            Новый опрос
          </h1>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Обложка опроса
            </label>
            {!preview ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-gray-400">
                  <ImageIcon className="w-8 h-8 mb-2" />
                  <p className="text-xs">Нажмите для загрузки изображения</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-red-50 transition shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название
            </label>
            <input
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white outline-none transition"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="О чем этот опрос?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Описание
            </label>
            <textarea
              className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white outline-none transition resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительные детали..."
            />
          </div>

          {/* ✅ НОВОЕ: Поле выбора категории */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
              <Tag size={16} />
              Категория
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white outline-none transition appearance-none cursor-pointer"
                disabled={loadingCategories}
              >
                {loadingCategories ? (
                  <option value="Общее">Загрузка категорий...</option>
                ) : (
                  categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Выберите наиболее подходящую категорию для вашего опроса
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Варианты ответов
            </label>
            <div className="space-y-3">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white outline-none transition"
                    placeholder={`Вариант ${i + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    required={i < 2}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <Plus size={16} /> Добавить вариант
            </button>
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="anon"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 dark:border-gray-600 focus:ring-indigo-500 dark:bg-gray-700"
            />
            <label
              htmlFor="anon"
              className="text-sm text-gray-700 dark:text-gray-300 select-none cursor-pointer"
            >
              Анонимное голосование
            </label>
          </div>

          <button className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 dark:shadow-none">
            Опубликовать
          </button>
        </form>
      </div>
    </>
  );
}
