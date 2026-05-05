import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PollDetail from '../PollDetail';

const {
  apiGetMock,
  apiPostMock,
  apiDeleteMock,
  navigateMock,
} = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
  apiDeleteMock: vi.fn(),
  navigateMock: vi.fn(),
}));

let authState = {
  user: { id: 1 },
  hasPermission: (_permission: string) => true,
};

vi.mock('../../api', () => ({
  default: {
    get: apiGetMock,
    post: apiPostMock,
    delete: apiDeleteMock,
  },
}));

vi.mock('../../AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => navigateMock,
  };
});

const poll = {
  id: 1,
  title: 'Poll title',
  description: 'Poll description',
  image_url: 'https://example.com/image.jpg',
  is_active: true,
  is_anonymous: false,
  created_by: 1,
  created_at: '2026-04-23T10:00:00Z',
  options: [
    { id: 10, poll_id: 1, text: 'Yes', vote_count: 3, voter_emails: ['a@test.com'] },
    { id: 11, poll_id: 1, text: 'No', vote_count: 1, voter_emails: [] },
  ],
  total_votes: 4,
  user_voted: false,
  category: 'Общее',
};

describe('PollDetail page', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiDeleteMock.mockReset();
    navigateMock.mockReset();
    authState = {
      user: { id: 1 },
      hasPermission: (_permission: string) => true,
    };
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
  });

  it('loads poll and allows voting when permission exists', async () => {
    apiGetMock.mockResolvedValue({ data: poll });
    apiPostMock.mockResolvedValue({ data: { message: 'ok' } });

    render(<PollDetail />);

    expect(await screen.findByRole('heading', { name: 'Poll title' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/polls/1/vote', {
        poll_id: 1,
        option_id: 10,
      });
      expect(apiGetMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error state when poll loading fails', async () => {
    apiGetMock.mockRejectedValue({ response: { data: { detail: 'Опрос не найден' } } });

    render(<PollDetail />);

    expect(await screen.findByRole('heading', { name: 'Опрос не найден' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Вернуться к списку опросов' }));
    expect(navigateMock).toHaveBeenCalledWith('/app');
  });

  it('shows no-vote warning when role has no vote permission', async () => {
    authState = {
      user: { id: 2 },
      hasPermission: (permission: string) => permission !== 'poll:vote',
    };
    apiGetMock.mockResolvedValue({
      data: {
        ...poll,
        created_by: 2,
        user_voted: true,
      },
    });

    render(<PollDetail />);

    expect(await screen.findByText('У вашей роли нет права голосования.')).toBeInTheDocument();
    expect(screen.getByText('Голосовали: a@test.com')).toBeInTheDocument();
  });

  it('deletes poll for owner with delete permission', async () => {
    authState = {
      user: { id: 1 },
      hasPermission: (permission: string) =>
        permission === 'poll:delete_own' || permission === 'poll:vote',
    };

    apiGetMock.mockResolvedValue({ data: poll });
    apiDeleteMock.mockResolvedValue({ data: { message: 'ok' } });

    render(<PollDetail />);

    await screen.findByRole('heading', { name: 'Poll title' });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить опрос' }));

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith('/polls/1');
      expect(navigateMock).toHaveBeenCalledWith('/app');
    });
  });
});
