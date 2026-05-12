import { defineCommand } from 'citty';
import { resolveFormat, validateFormat, printOutput, fail } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';
import {
  listPendingActions,
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
        code: 'CONFLICT',
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
