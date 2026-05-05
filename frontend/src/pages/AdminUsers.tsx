import { useEffect, useState } from "react";
import api from "../api";
import Seo from "../components/Seo";
import type { UserRole } from "../types";

interface UserRow {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

interface ApiErrorShape {
  response?: {
    data?: {
      detail?: string;
    };
  };
}

const roles: UserRole[] = ["user", "moderator", "admin"];

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get<UserRow[]>("/admin/users");
      setUsers(response.data);
    } catch (error) {
      console.error("Ошибка загрузки пользователей", error);
      alert("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const updateRole = async (userId: number, role: UserRole) => {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, role } : user)),
      );
    } catch (error: unknown) {
      const apiError = error as ApiErrorShape;
      console.error("Ошибка обновления роли", error);
      alert(apiError.response?.data?.detail || "Не удалось обновить роль");
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Загрузка пользователей...</div>;
  }

  return (
    <>
      <Seo
        title="Управление ролями пользователей"
        description="Административная панель для управления ролями пользователей."
        canonicalUrl="/app/admin/users"
        noindex
        nofollow
      />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Управление ролями
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Только администратор может изменять роли пользователей.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Имя</th>
                <th className="py-3 pr-4">Дата регистрации</th>
                <th className="py-3">Роль</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 dark:border-gray-700/50"
                >
                  <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-400">
                    {user.id}
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-900 dark:text-gray-100">
                    {user.email}
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">
                    {user.full_name || "-"}
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="py-3">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        updateRole(user.id, event.target.value as UserRole)
                      }
                      disabled={updatingUserId === user.id}
                      className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
