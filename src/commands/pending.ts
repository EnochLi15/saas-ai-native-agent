import { defineCommand } from 'citty';
import { resolveFormat, validateFormat, printOutput, fail } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';
import { getToken } from '../lib/auth-store.js';
import { writeAuditLog } from '../lib/audit-log.js';
import { createLinearComment, getIssue } from '../lib/linear-api.js';
import {
  getApprovablePendingAction,
  listPendingActions,
  markPendingActionApproved,
  PendingActionConflictError,
  PendingActionNotFoundError,
  rejectPendingAction,
  showPendingAction,
} from '../lib/pending-store.js';

function validateOutput(args: { output?: string }) {
  if (!args.output) return;

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

function failPendingError(err: unknown): never {
  const message = (err as Error)?.message || 'Unknown error';

  if (err instanceof PendingActionNotFoundError) {
    fail(
      {
        code: 'NOT_FOUND',
        message,
        field: 'id',
      },
      ExitCode.NOT_FOUND,
    );
  }

  if (err instanceof PendingActionConflictError) {
    fail(
      {
        code: err.code,
        message,
        field: 'id',
      },
      ExitCode.CONFLICT,
    );
  }

  fail(
    {
      code: 'PENDING_STORE_ERROR',
      message,
    },
    ExitCode.GENERAL_FAILURE,
  );
}

async function requireLinearToken(): Promise<string> {
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

export const pendingListCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List pending actions',
  },
  args: {
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    validateOutput(args);

    try {
      printOutput(await listPendingActions(), resolveFormat(args.output));
    } catch (err: unknown) {
      failPendingError(err);
    }
  },
});

export const pendingShowCommand = defineCommand({
  meta: {
    name: 'show',
    description: 'Show a pending action',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Pending action id',
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

    try {
      printOutput(await showPendingAction(args.id), resolveFormat(args.output));
    } catch (err: unknown) {
      failPendingError(err);
    }
  },
});

export const pendingRejectCommand = defineCommand({
  meta: {
    name: 'reject',
    description: 'Reject a pending action',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Pending action id',
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

    try {
      printOutput(await rejectPendingAction(args.id), resolveFormat(args.output));
    } catch (err: unknown) {
      failPendingError(err);
    }
  },
});

export const pendingApproveCommand = defineCommand({
  meta: {
    name: 'approve',
    description: 'Approve and execute a pending action',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Pending action id',
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

    let action;
    try {
      action = await getApprovablePendingAction(args.id);
      if (action.provider !== 'linear' || action.capability_id !== 'linear.comment.propose') {
        throw new PendingActionConflictError(
          `Pending action "${args.id}" is not a supported Linear comment action.`,
          'UNSUPPORTED_ACTION',
        );
      }
    } catch (err: unknown) {
      failPendingError(err);
    }

    const token = await requireLinearToken();

    try {
      const issue = await getIssue(token, action.input.issue);
      const comment = await createLinearComment(token, {
        issueId: issue.id,
        body: action.input.body,
      });
      const approved = await markPendingActionApproved(action.id, {
        comment_id: comment.id,
        url: comment.url,
      });

      await writeAuditLog({
        timestamp: approved.executed_at ?? new Date().toISOString(),
        provider: approved.provider,
        capability_id: approved.capability_id,
        pending_action_id: approved.id,
        status: 'approved',
        summary: approved.summary,
        result: approved.execution_result,
      });

      printOutput(
        {
          id: approved.id,
          status: approved.status,
          comment_id: comment.id,
          url: comment.url,
          executed_at: approved.executed_at,
        },
        resolveFormat(args.output),
      );
    } catch (err: unknown) {
      const message = (err as Error)?.message || 'Unknown error';
      await writeAuditLog({
        timestamp: new Date().toISOString(),
        provider: action.provider,
        capability_id: action.capability_id,
        pending_action_id: action.id,
        status: 'failed',
        summary: action.summary,
        error: {
          code: 'LINEAR_API_ERROR',
          message,
        },
      });

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
