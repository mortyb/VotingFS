import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api";
import Seo from "../components/Seo";
import type { Poll, PaginatedResponse } from "../types";
import {
  Search,
  Filter,
  ChevronDown,
  X,
  Tag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type FeaturedQuote = {
  text: string;
  author: string;
  source?: string;
  source_url?: string | null;
  tags?: string[];
  fallback?: boolean;
  fetched_at?: string;
};

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get("search")?.trim() ?? "";
  const initialCategory = searchParams.get("category") ?? "Все";
  const sortFromQuery = searchParams.get("sort") ?? "newest";
  const initialSort = ["newest", "oldest", "title_asc", "title_desc"].includes(
    sortFromQuery,
  )
    ? sortFromQuery
    : "newest";
  const parsedPage = Number(searchParams.get("page") ?? "1");
  const initialPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [pollsData, setPollsData] = useState<PaginatedResponse<Poll> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [featuredQuote, setFeaturedQuote] = useState<FeaturedQuote | null>(
    null,
  );
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Состояния для фильтров
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] =
    useState<string>(initialCategory);
  const [categories, setCategories] = useState<string[]>(["Все"]);
  const [sortBy, setSortBy] = useState(initialSort);
  const [showFilters, setShowFilters] = useState(false);

  // Пагинация
  const [currentPage, setCurrentPage] = useState(initialPage);
  const itemsPerPage = 1; // должно совпадать с limit на бэкенде

  const loadCategories = async () => {
    try {
      const response = await api.get("/categories");
      setCategories(["Все", ...(response.data.categories || [])]);
    } catch (error) {
      console.error("Ошибка загрузки категорий:", error);
    }
  };

  const loadFeaturedQuote = async () => {
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const response = await api.get<FeaturedQuote>(
        "/integration/featured-quote",
      );
      setFeaturedQuote(response.data);
    } catch (error) {
      console.error("Ошибка загрузки цитаты:", error);
      setFeaturedQuote(null);
      setQuoteError("Не удалось загрузить вдохновляющую цитату");
    } finally {
      setQuoteLoading(false);
    }
  };

  const loadPolls = useCallback(() => {
    setLoading(true);

    const skip = (currentPage - 1) * itemsPerPage;
    const params: Record<string, string | number> = {
      skip,
      limit: itemsPerPage,
    };

    if (selectedCategory !== "Все") params.category = selectedCategory;
    if (searchQuery.trim()) params.search = searchQuery;
    params.sort_by = sortBy;

    api
      .get<PaginatedResponse<Poll>>("/polls", { params })
      .then((res) => {
        setPollsData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentPage, itemsPerPage, searchQuery, selectedCategory, sortBy]);

  // Загружаем категории и внешнюю цитату
  useEffect(() => {
    loadCategories();
    loadFeaturedQuote();
  }, []);

  // Загружаем опросы при изменении фильтров или страницы
  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  // Сохраняем состояние фильтров в URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (selectedCategory !== "Все") params.set("category", selectedCategory);
    if (sortBy !== "newest") params.set("sort", sortBy);
    if (currentPage > 1) params.set("page", String(currentPage));
    setSearchParams(params, { replace: true });
  }, [searchQuery, selectedCategory, sortBy, currentPage, setSearchParams]);

  const handleSearch = () => {
    setCurrentPage(1); // Сброс на первую страницу при новом поиске
    setSearchQuery(searchInput.trim());
  };

  const handleReset = () => {
    setSearchInput("");
    setSearchQuery("");
    setSelectedCategory("Все");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Прокрутка вверх при смене страницы
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = pollsData ? Math.ceil(pollsData.total / itemsPerPage) : 0;
  const polls = pollsData?.polls || [];

  //проверяем, есть ли активные фильтры
  const hasActiveFilters =
    selectedCategory !== "Все" ||
    searchQuery.trim() !== "" ||
    sortBy !== "newest";

  if (loading && polls.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Загрузка опросов...</p>
      </div>
    );
  }

  const dashboardJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Обзор голосований",
    description:
      "Каталог активных опросов с поиском, фильтрацией и пагинацией.",
    url: window.location.origin + "/app",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: (pollsData?.polls || []).map((poll, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${window.location.origin}/app/polls/${poll.id}`,
        name: poll.title,
      })),
    },
  };

  return (
    <main>
      <Seo
        title="Обзор голосований"
        description="Каталог активных опросов с поиском, фильтрацией и удобной навигацией."
        canonicalUrl="/app"
        noindex
        nofollow
        ogTitle="PollMaster — обзор голосований"
        ogDescription="Просматривайте активные опросы, находите интересные темы и переходите к деталям."
        ogType="website"
        jsonLd={dashboardJsonLd}
      />

      <header className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Обзор голосований
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {pollsData && `Всего опросов: ${pollsData.total}`}
            </p>
          </div>
        </div>

        <section
          aria-label="Вдохновляющая цитата"
          className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-indigo-100 dark:border-gray-600 p-5"
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-300 font-semibold">
              Вдохновение дня
            </p>
            {quoteLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                Загрузка цитаты...
              </p>
            ) : featuredQuote ? (
              <>
                <blockquote className="text-lg font-medium text-gray-800 dark:text-white">
                  «{featuredQuote.text}»
                </blockquote>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  — {featuredQuote.author}
                  {featuredQuote.fallback
                    ? " · локальный резервный источник"
                    : ""}
                </p>
                {featuredQuote.source_url && !featuredQuote.fallback && (
                  <a
                    href={featuredQuote.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline"
                  >
                    Источник цитаты
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-300">
                {quoteError ||
                  "Сейчас не удалось загрузить внешние данные, но приложение продолжает работать."}
              </p>
            )}
          </div>
        </section>
      </header>

      {/* Панель поиска и фильтров */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-8 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Поиск */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSearch();
            }}
            className="flex-1"
          >
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Поиск по названию опроса..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white outline-none transition"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>

          {/* Кнопка фильтров */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition min-w-[140px]"
          >
            <Filter size={20} />
            Фильтры
            <ChevronDown
              size={16}
              className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Расширенные фильтры */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Категория */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Tag size={16} />
                Категория
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Сортировка */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Сортировка
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer"
              >
                <option value="newest">Сначала новые</option>
                <option value="oldest">Сначала старые</option>
                <option value="title_asc">По названию (А-Я)</option>
                <option value="title_desc">По названию (Я-А)</option>
              </select>
            </div>

            {/* Кнопки действий */}
            <div className="flex items-end gap-3">
              <button
                onClick={() => {
                  setCurrentPage(1);
                  setSearchQuery(searchInput.trim());
                }}
                className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition shadow-md"
              >
                Применить
              </button>
              <button
                onClick={handleReset}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Сбросить все
              </button>
            </div>
          </div>
        )}

        {/* Кнопка поиска для мобильных */}
        <div className="mt-4 md:hidden">
          <button
            onClick={() => {
              setCurrentPage(1);
              setSearchQuery(searchInput.trim());
            }}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Найти опросы
          </button>
        </div>
      </div>

      {/* Отображение активных фильтров */}
      {hasActiveFilters && (
        <div className="mb-6 flex flex-wrap gap-2">
          {selectedCategory !== "Все" && (
            <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-3 py-1.5 rounded-full text-sm font-medium">
              <Tag size={14} />
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory("Все")}
                className="ml-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                <X size={14} />
              </button>
            </span>
          )}

          {searchQuery.trim() !== "" && (
            <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded-full text-sm font-medium">
              <Search size={14} />
              Поиск: "{searchQuery}"
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="ml-1 hover:text-blue-600 dark:hover:text-blue-400 transition"
              >
                <X size={14} />
              </button>
            </span>
          )}

          {sortBy !== "newest" && (
            <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1.5 rounded-full text-sm font-medium">
              {sortBy === "oldest" ? "Сначала старые" : "Другая сортировка"}
              <button
                onClick={() => setSortBy("newest")}
                className="ml-1 hover:text-green-600 dark:hover:text-green-400 transition"
              >
                <X size={14} />
              </button>
            </span>
          )}

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 px-3 py-1.5 text-sm transition"
            >
              Очистить все
            </button>
          )}
        </div>
      )}

      {/* Сетка опросов */}
      {!loading && polls.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {polls.map((poll) => (
              <Link
                key={poll.id}
                to={`/app/polls/${poll.id}`}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full overflow-hidden"
              >
                {/* Бейдж категории */}
                {poll.category && (
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-indigo-600/90 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm flex items-center gap-1">
                      <Tag size={10} />
                      {poll.category}
                    </span>
                  </div>
                )}

                {poll.image_url ? (
                  <div className="h-40 w-full bg-gray-100 dark:bg-gray-700 overflow-hidden relative">
                    <img
                      src={poll.image_url}
                      alt={poll.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 w-full"></div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition mb-2">
                      {poll.title}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">
                      {poll.description || "Нет описания"}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-400 dark:text-gray-500">
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md font-medium">
                      {poll.options?.length || 0} вариантов
                    </span>
                    <span>
                      {new Date(poll.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Показано {(currentPage - 1) * itemsPerPage + 1} -{" "}
                {Math.min(currentPage * itemsPerPage, pollsData?.total || 0)} из{" "}
                {pollsData?.total} опросов
              </div>

              <div className="flex items-center gap-2">
                {/* Кнопка "Назад" */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                    currentPage === 1
                      ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <ChevronLeft size={18} />
                  Назад
                </button>

                {/* Номера страниц */}
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    let pageNum;

                    // Логика отображения номеров страниц
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                          currentPage === pageNum
                            ? "bg-indigo-600 text-white font-semibold"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* Многоточие если много страниц */}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500">
                        ...
                      </span>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                {/* Кнопка "Вперед" */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                    currentPage >= totalPages
                      ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  Вперед
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                Страница {currentPage} из {totalPages}
              </div>
            </div>
          )}
        </>
      )}

      {/* Сообщение если нет результатов */}
      {!loading && polls.length === 0 && (
        <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="text-center p-8">
            <div className="bg-gray-100 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-400 dark:text-gray-500" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {hasActiveFilters ? "Ничего не найдено" : "Здесь пока пусто"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
              {hasActiveFilters
                ? "Попробуйте изменить параметры поиска или сбросить фильтры"
                : "Создайте первый опрос и начните собирать мнения"}
            </p>

            <div className="flex gap-3">
              {hasActiveFilters ? (
                <button
                  onClick={handleReset}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                  Сбросить фильтры
                </button>
              ) : (
                <Link
                  to="/app/create"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                  Создать опрос
                </Link>
              )}
              <Link
                to="/app"
                className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                На главную
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {loading && (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">
            Загрузка опросов...
          </p>
        </div>
      )}
    </main>
  );
}
