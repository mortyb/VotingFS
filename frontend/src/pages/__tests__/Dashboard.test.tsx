import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Dashboard from '../Dashboard';

const { apiGetMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  default: {
    get: apiGetMock,
  },
}));

const pollItem = {
  id: 1,
  title: 'Best language',
  description: 'Choose wisely',
  image_url: 'https://example.com/image.jpg',
  is_active: true,
  is_anonymous: false,
  created_by: 1,
  created_at: '2026-04-23T10:00:00Z',
  options: [
    { id: 10, poll_id: 1, text: 'Python', vote_count: 4, voter_emails: [] },
    { id: 11, poll_id: 1, text: 'Go', vote_count: 2, voter_emails: [] },
  ],
  total_votes: 6,
  user_voted: false,
  category: 'Технологии',
};

describe('Dashboard page', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it('renders polls and featured quote from API', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({ data: { categories: ['Общее', 'Технологии'] } });
      }
      if (url === '/integration/featured-quote') {
        return Promise.resolve({
          data: {
            text: 'External quote',
            author: 'API',
            source_url: 'https://example.com',
            fallback: false,
          },
        });
      }
      if (url === '/polls') {
        return Promise.resolve({
          data: {
            polls: [pollItem],
            total: 1,
            skip: 0,
            limit: 1,
            has_more: false,
          },
        });
      }
      return Promise.reject(new Error('unknown endpoint'));
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Обзор голосований' })).toBeInTheDocument();
    expect(screen.getByText('Best language')).toBeInTheDocument();
    expect(screen.getByText('Источник цитаты')).toHaveAttribute('href', 'https://example.com');
  });

  it('shows graceful quote error and empty state when no polls', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({ data: { categories: ['Общее'] } });
      }
      if (url === '/integration/featured-quote') {
        return Promise.reject(new Error('quote down'));
      }
      if (url === '/polls') {
        return Promise.resolve({
          data: {
            polls: [],
            total: 0,
            skip: 0,
            limit: 1,
            has_more: false,
          },
        });
      }
      return Promise.reject(new Error('unknown endpoint'));
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Не удалось загрузить вдохновляющую цитату')).toBeInTheDocument();
    expect(screen.getByText('Здесь пока пусто')).toBeInTheDocument();
  });

  it('applies search from input and resets filters', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({ data: { categories: ['Общее'] } });
      }
      if (url === '/integration/featured-quote') {
        return Promise.resolve({ data: { text: 'q', author: 'a', fallback: true } });
      }
      if (url === '/polls') {
        return Promise.resolve({
          data: {
            polls: [],
            total: 0,
            skip: 0,
            limit: 1,
            has_more: false,
          },
        });
      }
      return Promise.reject(new Error('unknown endpoint'));
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Здесь пока пусто');

    const input = screen.getByPlaceholderText('Поиск по названию опроса...');
    fireEvent.change(input, { target: { value: 'python' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));

    await waitFor(() => {
      expect(screen.getByText('Здесь пока пусто')).toBeInTheDocument();
    });
  });
});
