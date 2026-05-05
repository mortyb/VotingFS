import { expect, test } from '@playwright/test';

type RouteJson = {
  status?: number;
  body?: unknown;
};

const json = (payload: RouteJson) => ({
  status: payload.status ?? 200,
  contentType: 'application/json',
  body: JSON.stringify(payload.body ?? {}),
});

test('e2e: login -> dashboard -> logout', async ({ page }) => {
  await page.route('**/auth/refresh', async (route) => {
    await route.fulfill(json({ status: 401, body: { detail: 'no refresh cookie' } }));
  });

  await page.route('**/auth/login', async (route) => {
    await route.fulfill(json({ body: { access_token: 'token-1', token_type: 'bearer' } }));
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill(
      json({
        body: {
          id: 1,
          email: 'admin@example.com',
          role: 'admin',
          permissions: ['poll:read', 'poll:create', 'poll:vote', 'user:manage_roles'],
        },
      }),
    );
  });

  await page.route('**/categories', async (route) => {
    await route.fulfill(json({ body: { categories: ['Общее'] } }));
  });

  await page.route('**/integration/featured-quote', async (route) => {
    await route.fulfill(
      json({
        body: {
          text: 'External quote',
          author: 'API',
          source: 'external-api',
          source_url: 'https://example.com',
          fallback: false,
        },
      }),
    );
  });

  await page.route('**/polls**', async (route) => {
    await route.fulfill(json({ body: { polls: [], total: 0, skip: 0, limit: 1, has_more: false } }));
  });

  await page.route('**/auth/logout', async (route) => {
    await route.fulfill(json({ body: { message: 'ok' } }));
  });

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@example.com');
  await page.locator('input[type="password"]').fill('StrongPass123!');
  await page.getByRole('button', { name: 'Войти' }).click();

  await expect(page.getByRole('heading', { name: 'Обзор голосований' })).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('e2e: user cannot open admin users route', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'token-user');
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill(
      json({
        body: {
          id: 2,
          email: 'user@example.com',
          role: 'user',
          permissions: ['poll:read', 'poll:create', 'poll:vote'],
        },
      }),
    );
  });

  await page.route('**/categories', async (route) => {
    await route.fulfill(json({ body: { categories: ['Общее'] } }));
  });

  await page.route('**/integration/featured-quote', async (route) => {
    await route.fulfill(json({ body: { text: 'Quote', author: 'API', fallback: false } }));
  });

  await page.route('**/polls**', async (route) => {
    await route.fulfill(json({ body: { polls: [], total: 0, skip: 0, limit: 1, has_more: false } }));
  });

  await page.goto('/app/admin/users');
  await expect(page).toHaveURL(/\/app$/);
});

test('e2e: graceful degradation when external API fails', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'token-user');
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill(
      json({
        body: {
          id: 3,
          email: 'user@example.com',
          role: 'user',
          permissions: ['poll:read', 'poll:create', 'poll:vote'],
        },
      }),
    );
  });

  await page.route('**/categories', async (route) => {
    await route.fulfill(json({ body: { categories: ['Общее'] } }));
  });

  await page.route('**/integration/featured-quote', async (route) => {
    await route.fulfill(json({ status: 500, body: { detail: 'down' } }));
  });

  await page.route('**/polls**', async (route) => {
    await route.fulfill(json({ body: { polls: [], total: 0, skip: 0, limit: 1, has_more: false } }));
  });

  await page.goto('/app');
  await expect(page.getByText('Не удалось загрузить вдохновляющую цитату')).toBeVisible();
});
