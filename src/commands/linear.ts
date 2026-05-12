import { defineCommand } from 'citty';
import { readFile } from 'node:fs/promises';
import { resolveFormat, validateFormat, printOutput, fail, logger } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';
import { getToken } from '../lib/auth-store.js';
import { getIssue, LinearNotFoundError, searchIssues, searchTeams } from '../lib/linear-api.js';
import { createCommentPendingAction } from '../lib/pending-store.js';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 100;

async function requireToken(): Promise<string> {
  const token = await getToken('linear');
  if (!token) {
    fail(
      {
        code: 'AUTH_REQUIRED',
        message: 'Linear token is missing. Run "saas-agent auth login linear" to authenticate.',
        suggestion: 'saas-agent auth login linear --token-stdin',
      },
      ExitCode.AUTH,
    );
  }
  return token;
}

function validateOutput(args: { output?: string }) {
  if (args.output) {
    const err = validateFormat(args.output);
    if (err) {
      fail(
        {
          code: 'invalid_enum_value',
          message: err,
          field: 'output',
          suggestion: 'Use --output json or --output text.',
        },
        ExitCode.USAGE,
      );
    }
  }
}

function parseLimit(value: string | undefined): number {
  if (!value) return DEFAULT_SEARCH_LIMIT;

  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
    fail(
      {
        code: 'VALIDATION_ERROR',
        message: `Invalid --limit value "${value}". Expected an integer between 1 and ${MAX_SEARCH_LIMIT}.`,
        field: 'limit',
        suggestion: `Use --limit ${DEFAULT_SEARCH_LIMIT} for the default bounded page size.`,
      },
      ExitCode.USAGE,
    );
  }

  return limit;
}

function validateDateFilter(field: string, value?: string): void {
  if (!value) return;

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    fail(
      {
        code: 'VALIDATION_ERROR',
        message: `Invalid --${field} value "${value}". Expected an ISO 8601 date or datetime.`,
        field,
      },
      ExitCode.USAGE,
    );
  }
}

async function resolveCommentBody(args: { body?: string; 'body-file'?: string }): Promise<string> {
  if (args.body && args['body-file']) {
    fail(
      {
        code: 'VALIDATION_ERROR',
        message: 'Use either --body or --body-file, not both.',
        field: 'body',
      },
      ExitCode.USAGE,
    );
  }

  let body = args.body;
  if (args['body-file']) {
    try {
      body = await readFile(args['body-file'], 'utf-8');
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Unable to read body file';
      fail(
        {
          code: 'VALIDATION_ERROR',
          message: `Unable to read --body-file "${args['body-file']}": ${message}`,
          field: 'body-file',
        },
        ExitCode.USAGE,
      );
    }
  }

  if (!body || !body.trim()) {
    fail(
      {
        code: 'VALIDATION_ERROR',
        message: 'A non-empty comment body is required via --body or --body-file.',
        field: 'body',
      },
      ExitCode.USAGE,
    );
  }

  return body.trim();
}

export const teamSearchCommand = defineCommand({
  meta: {
    name: 'search',
    description: 'Search Linear teams by name or key',
  },
  args: {
    query: {
      type: 'string',
      description: 'Search query for team name or key',
      valueHint: 'text',
    },
    limit: {
      type: 'string',
      description: 'Maximum number of teams to return (default: 20)',
      valueHint: 'number',
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    validateOutput(args);

    const token = await requireToken();
    const format = resolveFormat(args.output);
    const limit = args.limit ? parseInt(args.limit, 10) : 20;

    if (args.limit && (isNaN(limit) || limit < 1)) {
      fail(
        {
          code: 'VALIDATION_ERROR',
          message: `Invalid --limit value "${args.limit}". Expected a positive number.`,
          field: 'limit',
        },
        ExitCode.USAGE,
      );
    }

    try {
      logger.info(`Searching Linear teams...`);
      const result = await searchTeams(token, args.query, limit);
      printOutput(result, format);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Unknown error';
      fail(
        {
          code: 'LINEAR_API_ERROR',
          message: `Linear API request failed: ${message}`,
        },
        ExitCode.NETWORK,
      );
    }
  },
});

export const issueSearchCommand = defineCommand({
  meta: {
    name: 'search',
    description: 'Search Linear issues with bounded filters',
  },
  args: {
    team: {
      type: 'string',
      description: 'Filter by team key, id, or exact name',
      valueHint: 'team',
    },
    status: {
      type: 'string',
      description: 'Filter by issue state name',
      valueHint: 'status',
    },
    assignee: {
      type: 'string',
      description: 'Filter by assignee id, email, or exact name',
      valueHint: 'assignee',
    },
    label: {
      type: 'string',
      description: 'Filter by label name',
      valueHint: 'label',
    },
    'updated-before': {
      type: 'string',
      description: 'Filter issues updated before an ISO 8601 date or datetime',
      valueHint: 'date',
    },
    'updated-after': {
      type: 'string',
      description: 'Filter issues updated after an ISO 8601 date or datetime',
      valueHint: 'date',
    },
    limit: {
      type: 'string',
      description: `Maximum number of issues to return (default: ${DEFAULT_SEARCH_LIMIT}, max: ${MAX_SEARCH_LIMIT})`,
      valueHint: 'number',
    },
    cursor: {
      type: 'string',
      description: 'Pagination cursor returned from a previous search',
      valueHint: 'cursor',
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    validateOutput(args);

    const limit = parseLimit(args.limit);
    validateDateFilter('updated-before', args['updated-before']);
    validateDateFilter('updated-after', args['updated-after']);

    const token = await requireToken();
    const format = resolveFormat(args.output);

    try {
      logger.info('Searching Linear issues...');
      const result = await searchIssues(token, {
        team: args.team,
        status: args.status,
        assignee: args.assignee,
        label: args.label,
        updatedBefore: args['updated-before'],
        updatedAfter: args['updated-after'],
        limit,
        cursor: args.cursor,
      });
      printOutput(result, format);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Unknown error';

      if (err instanceof LinearNotFoundError) {
        fail(
          {
            code: 'NOT_FOUND',
            message,
            field: 'team',
          },
          ExitCode.NOT_FOUND,
        );
      }

      fail(
        {
          code: 'LINEAR_API_ERROR',
          message: `Linear API request failed: ${message}`,
        },
        ExitCode.NETWORK,
      );
    }
  },
});

export const issueGetCommand = defineCommand({
  meta: {
    name: 'get',
    description: 'Get Linear issue details by id or identifier',
  },
  args: {
    id_or_identifier: {
      type: 'positional',
      description: 'Issue id or identifier, such as ENG-123',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    validateOutput(args);

    const token = await requireToken();
    const format = resolveFormat(args.output);

    try {
      logger.info('Getting Linear issue...');
      const result = await getIssue(token, args.id_or_identifier);
      printOutput(result, format);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Unknown error';

      if (err instanceof LinearNotFoundError) {
        fail(
          {
            code: 'NOT_FOUND',
            message,
            field: 'id_or_identifier',
          },
          ExitCode.NOT_FOUND,
        );
      }

      fail(
        {
          code: 'LINEAR_API_ERROR',
          message: `Linear API request failed: ${message}`,
        },
        ExitCode.NETWORK,
      );
    }
  },
});

export const commentProposeCommand = defineCommand({
  meta: {
    name: 'propose',
    description: 'Create a pending Linear comment action without writing to Linear',
  },
  args: {
    issue: {
      type: 'string',
      description: 'Target issue id or identifier',
      required: true,
      valueHint: 'issue',
    },
    body: {
      type: 'string',
      description: 'Comment body text',
      valueHint: 'text',
    },
    'body-file': {
      type: 'string',
      description: 'Path to a file containing the comment body',
      valueHint: 'path',
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    validateOutput(args);

    const body = await resolveCommentBody(args);
    const token = await requireToken();
    const format = resolveFormat(args.output);

    try {
      logger.info('Validating Linear issue...');
      const issue = await getIssue(token, args.issue);
      const result = await createCommentPendingAction({
        issue: issue.identifier,
        body,
      });
      printOutput(result, format);
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Unknown error';

      if (err instanceof LinearNotFoundError) {
        fail(
          {
            code: 'NOT_FOUND',
            message,
            field: 'issue',
          },
          ExitCode.NOT_FOUND,
        );
      }

      fail(
        {
          code: 'LINEAR_API_ERROR',
          message: `Linear API request failed: ${message}`,
        },
        ExitCode.NETWORK,
      );
    }
  },
});
