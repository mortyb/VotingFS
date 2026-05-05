import { describe, expect, it } from 'vitest';

import { clearClientSession, getClientAccessToken, setClientAccessToken } from './api';

describe('api client token storage helpers', () => {
  it('sets, gets and clears access token in localStorage', () => {
    clearClientSession();

    expect(getClientAccessToken()).toBeNull();

    setClientAccessToken('abc123');
    expect(getClientAccessToken()).toBe('abc123');

    clearClientSession();
    expect(getClientAccessToken()).toBeNull();
  });
});
