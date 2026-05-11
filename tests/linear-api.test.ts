import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestFn = vi.fn();

// Mock graphql-request
vi.mock('graphql-request', () => {
  return {
    GraphQLClient: vi.fn().mockImplementation(() => ({
      request: requestFn,
    })),
  };
});

import { validateLinearToken } from '../src/lib/linear-api.js';

function mockResponse(response: unknown | Error) {
  if (response instanceof Error) {
    requestFn.mockRejectedValue(response);
  } else {
    requestFn.mockResolvedValue(response);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateLinearToken', () => {
  it('returns viewer info for valid token', async () => {
    mockResponse({
      viewer: { id: 'u-1', name: 'Test User', email: 'test@example.com' },
    });

    const result = await validateLinearToken('valid-token');
    expect(result.valid).toBe(true);
    expect(result.viewer).toEqual({
      id: 'u-1',
      name: 'Test User',
      email: 'test@example.com',
    });
  });

  it('returns invalid for authentication error', async () => {
    mockResponse(new Error('Authentication required'));

    const result = await validateLinearToken('bad-token');
    expect(result.valid).toBe(false);
    expect(result.viewer).toBeNull();
  });

  it('returns invalid for unauthorized error', async () => {
    mockResponse(new Error('Unauthorized'));

    const result = await validateLinearToken('expired-token');
    expect(result.valid).toBe(false);
    expect(result.viewer).toBeNull();
  });

  it('returns invalid for network errors', async () => {
    mockResponse(new Error('fetch failed'));

    const result = await validateLinearToken('some-token');
    expect(result.valid).toBe(false);
    expect(result.viewer).toBeNull();
  });
});
