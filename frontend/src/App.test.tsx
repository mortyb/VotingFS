import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

let authState = {
  isAuthenticated: false,
  isLoadingUser: false,
  hasPermission: (_permission: string) => false,
};

vi.mock('./AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => authState,
}));

vi.mock('./pages/Login', () => ({ default: () => <div>LOGIN_PAGE</div> }));
vi.mock('./pages/Register', () => ({ default: () => <div>REGISTER_PAGE</div> }));
vi.mock('./pages/Landing', () => ({ default: () => <div>LANDING_PAGE</div> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>DASHBOARD_PAGE</div> }));
vi.mock('./pages/CreatePoll', () => ({ default: () => <div>CREATE_PAGE</div> }));
vi.mock('./pages/PollDetail', () => ({ default: () => <div>POLL_DETAIL_PAGE</div> }));
vi.mock('./pages/ProfileSettings', () => ({ default: () => <div>PROFILE_PAGE</div> }));
vi.mock('./pages/AdminUsers', () => ({ default: () => <div>ADMIN_USERS_PAGE</div> }));
vi.mock('./pages/NotFound', () => ({ default: () => <div>NOT_FOUND_PAGE</div> }));
vi.mock('./Layout', () => ({ default: () => <div>LAYOUT_PAGE</div> }));

describe('App routing and guards', () => {
  beforeEach(() => {
    authState = {
      isAuthenticated: false,
      isLoadingUser: false,
      hasPermission: (_permission: string) => false,
    };
  });

  it('redirects guest from /app to login', () => {
    window.history.pushState({}, '', '/app');
    render(<App />);

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
  });

  it('redirects authenticated user without permission from admin route to /app', () => {
    authState = {
      isAuthenticated: true,
      isLoadingUser: false,
      hasPermission: (_permission: string) => false,
    };

    window.history.pushState({}, '', '/app/admin/users');
    render(<App />);

    expect(screen.getByText('LAYOUT_PAGE')).toBeInTheDocument();
  });

  it('shows admin page for user with permission', () => {
    authState = {
      isAuthenticated: true,
      isLoadingUser: false,
      hasPermission: (permission: string) => permission === 'user:manage_roles',
    };

    window.history.pushState({}, '', '/app/admin/users');
    render(<App />);

    expect(screen.getByText('LAYOUT_PAGE')).toBeInTheDocument();
  });
});
