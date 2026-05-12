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

import { getIssue, LinearNotFoundError, searchIssues, validateLinearToken } from '../src/lib/linear-api.js';

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

describe('searchIssues', () => {
  it('maps stable issue summaries and pagination metadata', async () => {
    mockResponse({
      issues: {
        nodes: [
          {
            id: 'issue-1',
            identifier: 'ENG-123',
            title: 'Triage flaky webhook',
            state: { name: 'In Progress' },
            priorityLabel: 'High',
            assignee: { name: 'Ada Lovelace' },
            labels: { nodes: [{ name: 'bug' }, { name: 'agent' }] },
            updatedAt: '2026-05-10T13:00:00.000Z',
            url: 'https://linear.app/acme/issue/ENG-123/triage-flaky-webhook',
          },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: 'cursor-1',
        },
      },
    });

    const result = await searchIssues('token', { limit: 10, cursor: 'cursor-0' });

    expect(result).toEqual({
      issues: [
        {
          id: 'issue-1',
          identifier: 'ENG-123',
          title: 'Triage flaky webhook',
          state: 'In Progress',
          priority: 'High',
          assignee: 'Ada Lovelace',
          labels: ['bug', 'agent'],
          updated_at: '2026-05-10T13:00:00.000Z',
          url: 'https://linear.app/acme/issue/ENG-123/triage-flaky-webhook',
        },
      ],
      page_info: {
        has_next_page: true,
        end_cursor: 'cursor-1',
      },
    });

    expect(requestFn).toHaveBeenCalledWith(expect.stringContaining('issues('), {
      first: 10,
      after: 'cursor-0',
      filter: undefined,
    });
  });

  it('builds bounded filter variables for supported filters', async () => {
    requestFn
      .mockResolvedValueOnce({
        teams: {
          nodes: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }],
        },
      })
      .mockResolvedValueOnce({
        issues: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

    await searchIssues('token', {
      team: 'eng',
      status: 'Todo',
      assignee: 'ada@example.com',
      label: 'Bug',
      updatedBefore: '2026-05-12',
      updatedAfter: '2026-05-01',
      limit: 20,
    });

    expect(requestFn).toHaveBeenLastCalledWith(expect.stringContaining('issues('), {
      first: 20,
      after: undefined,
      filter: {
        team: { id: { eq: 'team-1' } },
        state: { name: { eqIgnoreCase: 'Todo' } },
        assignee: { email: { eqIgnoreCase: 'ada@example.com' } },
        labels: { name: { eqIgnoreCase: 'Bug' } },
        updatedAt: { lt: '2026-05-12', gt: '2026-05-01' },
      },
    });
  });

  it('throws a typed not-found error for unknown team references', async () => {
    mockResponse({
      teams: {
        nodes: [{ id: 'team-1', key: 'ENG', name: 'Engineering' }],
      },
    });

    await expect(searchIssues('token', { team: 'DESIGN' })).rejects.toBeInstanceOf(
      LinearNotFoundError,
    );
  });
});

describe('getIssue', () => {
  const issueResponse = {
    issue: {
      id: 'issue-1',
      identifier: 'ENG-123',
      title: 'Triage flaky webhook',
      description: 'Webhook retries need clearer triage.',
      state: { name: 'Todo' },
      priorityLabel: 'Normal',
      assignee: null,
      labels: { nodes: [{ name: 'triage' }] },
      project: { name: 'Agent CLI' },
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-10T13:00:00.000Z',
      url: 'https://linear.app/acme/issue/ENG-123/triage-flaky-webhook',
      comments: {
        nodes: [
          {
            id: 'comment-1',
            body: 'Needs a repro command.',
            user: { name: 'Grace Hopper' },
            createdAt: '2026-05-10T14:00:00.000Z',
          },
        ],
      },
    },
  };

  it('looks up an issue by Linear id', async () => {
    mockResponse(issueResponse);

    const result = await getIssue('token', 'issue-1');

    expect(requestFn).toHaveBeenCalledWith(expect.stringContaining('issue(id: $id)'), {
      id: 'issue-1',
    });
    expect(result.id).toBe('issue-1');
    expect(result.identifier).toBe('ENG-123');
  });

  it('looks up an issue by identifier and returns a stable detail shape', async () => {
    mockResponse(issueResponse);

    const result = await getIssue('token', 'ENG-123');

    expect(result).toEqual({
      id: 'issue-1',
      identifier: 'ENG-123',
      title: 'Triage flaky webhook',
      description: 'Webhook retries need clearer triage.',
      state: 'Todo',
      priority: 'Normal',
      assignee: null,
      labels: ['triage'],
      project: 'Agent CLI',
      created_at: '2026-05-09T10:00:00.000Z',
      updated_at: '2026-05-10T13:00:00.000Z',
      url: 'https://linear.app/acme/issue/ENG-123/triage-flaky-webhook',
      comments: [
        {
          id: 'comment-1',
          body: 'Needs a repro command.',
          author: 'Grace Hopper',
          created_at: '2026-05-10T14:00:00.000Z',
        },
      ],
    });
  });

  it('throws a typed not-found error when Linear returns no issue', async () => {
    mockResponse({ issue: null });

    await expect(getIssue('token', 'ENG-404')).rejects.toBeInstanceOf(LinearNotFoundError);
  });
});
