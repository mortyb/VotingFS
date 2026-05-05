import { Link, Outlet, useLocation } from 'react-router-dom';  // Для навигации
import { useAuth } from './AuthContext';  // Для выхода из системы
import { LayoutDashboard, PlusCircle, LogOut, Vote, User } from 'lucide-react';  // Иконки
import clsx from 'clsx';  // Для условных классов CSS

export default function Layout() {
  const { logout, hasPermission, user } = useAuth();  // Функция выхода
  const location = useLocation();  // Текущий URL (для определения активной ссылки)

  // Список пунктов меню
  const navItems = [
    { icon: LayoutDashboard, label: 'Все опросы', path: '/app' },
    { icon: PlusCircle, label: 'Создать опрос', path: '/app/create' },
    { icon: User, label: 'Профиль', path: '/app/profile' },  // Ссылка на профиль
    { icon: User, label: 'Роли пользователей', path: '/app/admin/users' },
  ].filter((item) => {
    if (item.path === '/app/create') return hasPermission('poll:create');
    if (item.path === '/app/admin/users') return hasPermission('user:manage_roles');
    return true;
  });

  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-900 overflow-hidden transition-colors duration-300">
      
      {/* Боковая панель (меню) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-10">
        {/* Логотип */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-indigo-500 p-2 rounded-lg">
            <Vote size={24} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-wide">PollMaster</span>
        </div>
        {user && (
          <div className="px-6 py-3 text-xs text-slate-400 border-b border-slate-800">
            Роль: <span className="text-slate-200 font-medium">{user.role}</span>
          </div>
        )}

        {/* Навигационное меню */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Кнопка выхода */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={logout} 
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Основная область контента */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="h-full w-full p-8 md:p-12 max-w-7xl mx-auto">
           <Outlet />
        </div>
      </main>
    </div>
  );
}
