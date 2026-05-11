import { describe, it, expect, beforeEach, vi } from 'vitest';
import keytar from 'keytar';

vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

import { saveToken, getToken, deleteToken, hasToken } from '../src/lib/auth-store.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth-store', () => {
  describe('saveToken', () => {
    it('calls keytar.setPassword with correct args', async () => {
      await saveToken('linear', 'test-token-123');
      expect(keytar.setPassword).toHaveBeenCalledWith('saas-agent', 'linear', 'test-token-123');
    });
  });

  describe('getToken', () => {
    it('returns token from keychain', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue('stored-token');
      const token = await getToken('linear');
      expect(token).toBe('stored-token');
      expect(keytar.getPassword).toHaveBeenCalledWith('saas-agent', 'linear');
    });

    it('returns null when no token stored', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue(null);
      const token = await getToken('linear');
      expect(token).toBeNull();
    });
  });

  describe('deleteToken', () => {
    it('calls keytar.deletePassword', async () => {
      await deleteToken('linear');
      expect(keytar.deletePassword).toHaveBeenCalledWith('saas-agent', 'linear');
    });
  });

  describe('hasToken', () => {
    it('returns true when token exists', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue('exists');
      expect(await hasToken('linear')).toBe(true);
    });

    it('returns false when no token', async () => {
      vi.mocked(keytar.getPassword).mockResolvedValue(null);
      expect(await hasToken('linear')).toBe(false);
    });
  });
});
