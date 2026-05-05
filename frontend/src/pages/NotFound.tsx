import { Link } from "react-router-dom";
import { SearchX, ArrowLeft } from "lucide-react";
import Seo from "../components/Seo";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <Seo
        title="Страница не найдена"
        description="Запрошенная страница не найдена."
        noindex={true}
        nofollow={true}
      />
      <section className="max-w-xl w-full text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-8 md:p-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-5">
          <SearchX size={32} className="text-indigo-600 dark:text-indigo-300" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300 mb-2">
          404
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Страница не найдена
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Возможно, вы перешли по неверной ссылке или страница была удалена.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
          >
            <ArrowLeft size={18} />
            На главную
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center justify-center px-5 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Войти в аккаунт
          </Link>
        </div>
      </section>
    </main>
  );
}
