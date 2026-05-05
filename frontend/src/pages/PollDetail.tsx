import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import type { Poll } from "../types";
import { useAuth } from "../AuthContext";
import Seo from "../components/Seo";

export default function PollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollId = Number(id);
  const pageUrl = id ? `/app/polls/${id}` : "/app/polls";
  const canonicalUrl =
    typeof pollId === "number" && Number.isFinite(pollId) ? pageUrl : null;

  useEffect(() => {
    loadPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadPoll = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<Poll>(`/polls/${id}`);
      setPoll(response.data);
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : undefined;
      setPoll(null);
      setError(detail || "Не удалось загрузить опрос");
    } finally {
      setLoading(false);
    }
  };

  const vote = async (optionId: number) => {
    try {
      await api.post(`/polls/${id}/vote`, {
        poll_id: Number(id),
        option_id: optionId,
      });
      await loadPoll();
    } catch {
      alert("Ошибка при голосовании");
    }
  };

  const deletePoll = async () => {
    if (!confirm("Удалить этот опрос? Действие необратимо.")) return;

    try {
      await api.delete(`/polls/${id}`);
      navigate("/app");
    } catch (error: unknown) {
      const detail =
        error && typeof error === "object" && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : undefined;
      alert(detail || "Ошибка при удалении опроса");
    }
  };

  const canVote = hasPermission("poll:vote");
  const canDeleteAny = hasPermission("poll:delete_any");
  const canDeleteOwn = hasPermission("poll:delete_own");

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        Загрузка...
      </div>
    );
  }

  if (error || !poll) {
    return (
      <main className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
        <Seo
          title="Опрос не найден"
          description="Страница опроса недоступна или была удалена."
          canonicalUrl={canonicalUrl}
          ogTitle="Опрос не найден"
          ogDescription="Страница опроса недоступна или была удалена."
        />
        <section className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Опрос не найден
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {error || "Запрошенный опрос недоступен."}
          </p>
          <button
            onClick={() => navigate("/app")}
            className="px-5 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
          >
            Вернуться к списку опросов
          </button>
        </section>
      </main>
    );
  }

  const canDelete =
    canDeleteAny || (canDeleteOwn && user?.id === poll.created_by);
  const description = poll.description || "Опрос на платформе PollMaster.";
  const ogImage = poll.image_url || undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: poll.title,
    headline: poll.title,
    description,
    url: canonicalUrl ? `${window.location.origin}${canonicalUrl}` : undefined,
    datePublished: poll.created_at,
    image: ogImage,
    author: {
      "@type": "Person",
      name: "PollMaster",
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/VoteAction",
        userInteractionCount: poll.total_votes,
      },
    ],
  };

  return (
    <main className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
      <Seo
        title={poll.title}
        description={description}
        canonicalUrl={canonicalUrl}
        noindex
        nofollow
        ogTitle={poll.title}
        ogDescription={description}
        ogImage={ogImage || null}
        ogType="article"
        jsonLd={jsonLd}
      />

      <article>
        <header className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {poll.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Опубликован{" "}
              {new Date(poll.created_at).toLocaleDateString("ru-RU")}
              {poll.category ? ` • ${poll.category}` : ""}
            </p>
          </div>

          {canDelete && (
            <button
              onClick={deletePoll}
              className="px-3 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition"
            >
              Удалить опрос
            </button>
          )}
        </header>

        {poll.image_url && (
          <figure className="mb-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <img
              src={poll.image_url}
              alt={poll.title}
              loading="lazy"
              className="w-full max-h-[360px] object-cover"
            />
          </figure>
        )}

        {poll.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {poll.description}
          </p>
        )}

        <section aria-label="Варианты ответа" className="space-y-4">
          {poll.options.map((option) => {
            const percent = poll.total_votes
              ? Math.round((option.vote_count / poll.total_votes) * 100)
              : 0;

            if (poll.user_voted || !canVote) {
              return (
                <div key={option.id} className="mb-2">
                  <div className="flex justify-between text-sm mb-1 text-gray-700 dark:text-gray-200">
                    <span>{option.text}</span>
                    <span className="font-bold">
                      {percent}% ({option.vote_count})
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {!poll.is_anonymous &&
                    option.voter_emails &&
                    option.voter_emails.length > 0 && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Голосовали: {option.voter_emails.join(", ")}
                      </div>
                    )}
                </div>
              );
            }

            return (
              <button
                key={option.id}
                onClick={() => vote(option.id)}
                className="w-full text-left px-4 py-3 border border-gray-300 dark:border-gray-600 dark:text-white rounded hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition"
              >
                {option.text}
              </button>
            );
          })}
        </section>

        {!canVote && (
          <div className="mt-4 text-sm text-amber-600 dark:text-amber-400">
            У вашей роли нет права голосования.
          </div>
        )}

        <footer className="mt-6 text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
          Всего голосов: {poll.total_votes} •{" "}
          {poll.is_anonymous ? "Анонимный" : "Публичный"}
        </footer>
      </article>
    </main>
  );
}
