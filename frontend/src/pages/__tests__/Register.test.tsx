import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Register from '../Register';

const navigateMock = vi.fn();
const { loginMock, apiPostMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  apiPostMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  default: {
    post: apiPostMock,
  },
}));

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

describe('Register page', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginMock.mockReset();
    apiPostMock.mockReset();
  });

  it('registers and redirects to /app', async () => {
    apiPostMock.mockResolvedValueOnce({});
    loginMock.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/register', {
        email: 'new@example.com',
        password: 'StrongPass123!',
      });
      expect(loginMock).toHaveBeenCalledWith('new@example.com', 'StrongPass123!');
      expect(navigateMock).toHaveBeenCalledWith('/app');
    });
  });

  it('shows duplicate user error from backend', async () => {
    apiPostMock.mockRejectedValueOnce({ response: { status: 400 } });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'StrongPass123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() => {
      expect(screen.getByText('Такой пользователь уже существует')).toBeInTheDocument();
    });
  });
});
