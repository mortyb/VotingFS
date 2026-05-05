import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import Login from '../Login';

const loginMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../../AuthContext', () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('Login page', () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
  });

  it('shows error message when login fails', async () => {
    loginMock.mockRejectedValueOnce(new Error('invalid'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Неверный логин или пароль')).toBeInTheDocument();
    });
  });

  it('redirects to /app on successful login', async () => {
    loginMock.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const emailInput = screen.getByRole('textbox');
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'StrongPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/app');
    });
  });
});
