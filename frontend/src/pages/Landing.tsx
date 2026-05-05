import { Link } from "react-router-dom";
import Seo from "../components/Seo";
import { useAuth } from "../AuthContext";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Seo
        title="PollMaster — платформа голосований"
        description="Создавайте опросы, собирайте мнения и анализируйте результаты в PollMaster."
        canonicalUrl="/"
        ogTitle="PollMaster — платформа голосований"
        ogDescription="Публичный лендинг платформы PollMaster: опросы, голосование и аналитика мнений."
        ogType="website"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "PollMaster",
          url: `${window.location.origin}/`,
          description:
            "Платформа для создания опросов, голосования и анализа результатов.",
        }}
      />

      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
            PollMaster
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Создавайте опросы, собирайте честные мнения и принимайте решения на
            основе данных.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              to={isAuthenticated ? "/app" : "/login"}
              className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
            >
              {isAuthenticated ? "Открыть приложение" : "Войти"}
            </Link>
            <Link
              to={isAuthenticated ? "/app/create" : "/register"}
              className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {isAuthenticated ? "Создать опрос" : "Зарегистрироваться"}
            </Link>
          </div>
        </header>

        <section aria-label="Преимущества платформы" className="grid md:grid-cols-3 gap-6">
          <article className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Быстрый запуск
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Создайте опрос за минуту: заголовок, варианты, публикация.
            </p>
          </article>
          <article className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Прозрачные результаты
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Наглядный подсчет голосов и удобный просмотр по каждому варианту.
            </p>
          </article>
          <article className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Гибкие роли
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Разграничение доступа для пользователей, модераторов и админов.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
