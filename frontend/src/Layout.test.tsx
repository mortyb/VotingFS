import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Layout from './Layout';

const logoutMock = vi.fn();
const hasPermissionMock = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    logout: logoutMock,
    user: { role: 'user' },
    hasPermission: hasPermissionMock,
  }),
}));

describe('Layout role-based navigation', () => {
  beforeEach(() => {
    logoutMock.mockReset();
    hasPermissionMock.mockReset();
  });

  it('hides admin menu item for non-admin permission set', () => {
    hasPermissionMock.mockImplementation((permission: string) => permission === 'poll:create');

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<Layout />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Все опросы')).toBeInTheDocument();
    expect(screen.getByText('Создать опрос')).toBeInTheDocument();
    expect(screen.queryByText('Роли пользователей')).not.toBeInTheDocument();
  });

  it('shows admin menu item when permission granted', () => {
    hasPermissionMock.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<Layout />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Роли пользователей')).toBeInTheDocument();
  });
});
