import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

const {
  apiGetMock,
  apiPostMock,
  clearClientSessionMock,
  getClientAccessTokenMock,
  setClientAccessTokenMock,
} = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
  clearClientSessionMock: vi.fn(),
  getClientAccessTokenMock: vi.fn(),
  setClientAccessTokenMock: vi.fn(),
}));

vi.mock('./api', () => ({
  default: {
    get: apiGetMock,
    post: apiPostMock,
  },
  clearClientSession: clearClientSessionMock,
  getClientAccessToken: getClientAccessTokenMock,
  setClientAccessToken: setClientAccessTokenMock,
}));

function Probe() {
  const { isAuthenticated, isLoadingUser } = useAuth();
  if (isLoadingUser) return <div>loading</div>;
  return <div>{isAuthenticated ? 'authed' : 'guest'}</div>;
}

describe('AuthProvider session handling', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    clearClientSessionMock.mockReset();
    getClientAccessTokenMock.mockReset();
    setClientAccessTokenMock.mockReset();
  });

  it('clears local session when /auth/me fails for existing token', async () => {
    getClientAccessTokenMock.mockReturnValue('expired-token');
    apiGetMock.mockRejectedValueOnce(new Error('401'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('guest')).toBeInTheDocument();
    });

    expect(clearClientSessionMock).toHaveBeenCalled();
  });
});
