import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import Landing from '../Landing';

let isAuthenticatedValue = false;

vi.mock('../../AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: isAuthenticatedValue,
  }),
}));

describe('Landing page', () => {
  it('shows login/register links for guest', () => {
    isAuthenticatedValue = false;

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Зарегистрироваться' })).toHaveAttribute('href', '/register');
  });

  it('shows app links for authenticated user', () => {
    isAuthenticatedValue = true;

    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Открыть приложение' })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: 'Создать опрос' })).toHaveAttribute('href', '/app/create');
  });
});
