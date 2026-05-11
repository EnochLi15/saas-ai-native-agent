import { defineCommand } from 'citty';
import { resolveFormat, validateFormat, printOutput, fail, logger } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';
import { getToken } from '../lib/auth-store.js';
import { searchTeams } from '../lib/linear-api.js';

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
