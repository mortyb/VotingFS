export type UserRole = 'user' | 'moderator' | 'admin';
export type Permission =
  | 'poll:read'
  | 'poll:create'
  | 'poll:vote'
  | 'poll:update_own'
  | 'poll:update_any'
  | 'poll:delete_own'
  | 'poll:delete_any'
  | 'profile:read_own'
  | 'profile:update_own'
  | 'profile:avatar_manage'
  | 'user:manage_roles';

// Описывает один вариант ответа в опросе
export interface PollOption {
  id: number;               // Уникальный номер варианта
  poll_id: number;          // К какому опросу относится
  text: string;            // Текст варианта ("За", "Против" и т.д.)
  vote_count: number;      // Сколько голосов набрал
  voter_emails?: string[]; // Список проголосовавших (только для не-анонимных опросов)
}

// Описывает весь опрос
export interface Poll {
  id: number;               // Уникальный номер опроса
  title: string;           // Заголовок ("Выборы президента")
  description?: string;    // Описание (необязательно)
  image_url?: string;      // Ссылка на картинку (необязательно)
  is_active: boolean;      // Активен ли опрос
  is_anonymous: boolean;   // Анонимное ли голосование
  created_by: number;      // Кто создал (ID пользователя)
  created_at: string;      // Дата создания
  options: PollOption[];   // Варианты ответов
  total_votes: number;     // Общее количество голосов
  user_voted: boolean;     // Голосовал ли текущий пользователь
  category?: string;       // категория опроса
}

// Описывает профиль пользователя
export interface UserProfile {
  id: number;               // Уникальный номер пользователя
  email: string;           // Почта
  role: UserRole;
  full_name: string | null; // Имя (может быть не заполнено)
  bio: string | null;      // О себе (может быть не заполнено)
  avatar_url: string | null; // Ссылка на фото профиля
  is_active: boolean;      // Активен ли аккаунт
  created_at: string;      // Дата регистрации
  polls_created: number;   // Сколько опросов создал
  votes_count: number;     // Сколько раз проголосовал
  permissions: Permission[];
}

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  permissions: Permission[];
}

// Описывает пагинированный ответ для списка опросов
export interface PaginatedResponse<T> {
  polls: T[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}
