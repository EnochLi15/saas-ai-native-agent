import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestFn = vi.fn();

vi.mock('graphql-request', () => {
  return {
    GraphQLClient: vi.fn().mockImplementation(() => ({
      request: requestFn,
    })),
  };
});

import { searchTeams } from '../src/lib/linear-api.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchTeams', () => {
  const mockTeams = [
    { id: 't-1', key: 'PLAT', name: 'Platform' },
    { id: 't-2', key: 'ENG', name: 'Engineering' },
    { id: 't-3', key: 'DES', name: 'Design' },
  ];

  it('returns all teams when no query filter', async () => {
    requestFn.mockResolvedValue({ teams: { nodes: mockTeams } });

    const result = await searchTeams('valid-token');
    expect(result.teams).toHaveLength(3);
    expect(result.teams[0]).toEqual({ id: 't-1', key: 'PLAT', name: 'Platform' });
  });

  it('filters teams by name', async () => {
    requestFn.mockResolvedValue({ teams: { nodes: mockTeams } });

    const result = await searchTeams('valid-token', 'platform');
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].key).toBe('PLAT');
  });

  it('filters teams by key', async () => {
    requestFn.mockResolvedValue({ teams: { nodes: mockTeams } });

    const result = await searchTeams('valid-token', 'eng');
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].name).toBe('Engineering');
  });

  it('returns empty when no match', async () => {
    requestFn.mockResolvedValue({ teams: { nodes: mockTeams } });

    const result = await searchTeams('valid-token', 'nonexistent');
    expect(result.teams).toHaveLength(0);
  });

  it('respects limit parameter', async () => {
    requestFn.mockResolvedValue({ teams: { nodes: mockTeams } });

    await searchTeams('valid-token', undefined, 2);
    expect(requestFn).toHaveBeenCalledWith(
      expect.any(String),
      { first: 2 },
    );
  });

  it('uses default limit of 20', async () => {
    requestFn.mockResolvedValue({ teams: { nodes: [] } });

    await searchTeams('valid-token');
    expect(requestFn).toHaveBeenCalledWith(
      expect.any(String),
      { first: 20 },
    );
  });
});
