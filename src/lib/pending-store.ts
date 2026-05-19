import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export type PendingActionStatus = 'pending' | 'rejected' | 'approved';

export interface PendingAction {
  id: string;
  provider: string;
  capability_id: string;
  status: PendingActionStatus;
  summary: string;
  issue_reference: string;
  preview: {
    issue: string;
    body: string;
  };
  input: {
    issue: string;
    body: string;
  };
  parameters_hash: string;
  created_at: string;
  expires_at: string;
  rejected_at?: string;
  executed_at?: string;
  execution_result?: {
    comment_id: string | null;
    url: string | null;
  };
}

export interface PendingActionProposal {
  requires_confirmation: true;
  pending_action_id: string;
  id: string;
  capability_id: string;
  issue_reference: string;
  summary: string;
  preview: {
    issue: string;
    body: string;
  };
  expires_at: string;
}

export class PendingActionNotFoundError extends Error {
  constructor(id: string) {
    super(`Pending action "${id}" was not found.`);
    this.name = 'PendingActionNotFoundError';
  }
}

export class PendingActionConflictError extends Error {
  code: string;

  constructor(message: string, code = 'CONFLICT') {
    super(message);
    this.name = 'PendingActionConflictError';
    this.code = code;
  }
}

function storePath(): string {
  if (process.env.SAAS_AGENT_PENDING_STORE) {
    return process.env.SAAS_AGENT_PENDING_STORE;
  }

  const baseDir = process.env.SAAS_AGENT_HOME || join(homedir(), '.saas-agent');
  return join(baseDir, 'pending-actions.json');
}

async function readActions(): Promise<PendingAction[]> {
  try {
    const raw = await readFile(storePath(), 'utf-8');
    const parsed = JSON.parse(raw) as { actions?: PendingAction[] } | PendingAction[];
    return Array.isArray(parsed) ? parsed : parsed.actions ?? [];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeActions(actions: PendingAction[]): Promise<void> {
  const file = storePath();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ actions }, null, 2) + '\n', 'utf-8');
}

function hashParameters(input: { issue: string; body: string }): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function toProposal(action: PendingAction): PendingActionProposal {
  return {
    requires_confirmation: true,
    pending_action_id: action.id,
    id: action.id,
    capability_id: action.capability_id,
    issue_reference: action.issue_reference,
    summary: action.summary,
    preview: action.preview,
    expires_at: action.expires_at,
  };
}

export async function createCommentPendingAction(input: {
  issue: string;
  body: string;
  now?: Date;
}): Promise<PendingActionProposal> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const id = `act_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const action: PendingAction = {
    id,
    provider: 'linear',
    capability_id: 'linear.comment.propose',
    status: 'pending',
    summary: `Add a comment to ${input.issue}`,
    issue_reference: input.issue,
    preview: {
      issue: input.issue,
      body: input.body,
    },
    input: {
      issue: input.issue,
      body: input.body,
    },
    parameters_hash: hashParameters({ issue: input.issue, body: input.body }),
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  const actions = await readActions();
  actions.push(action);
  await writeActions(actions);

  return toProposal(action);
}

export async function listPendingActions(): Promise<{ actions: PendingAction[] }> {
  const actions = await readActions();
  return { actions: actions.filter(action => action.status === 'pending') };
}

export async function showPendingAction(id: string): Promise<PendingAction> {
  const actions = await readActions();
  const action = actions.find(candidate => candidate.id === id);
  if (!action) throw new PendingActionNotFoundError(id);
  return action;
}

export async function getApprovablePendingAction(id: string, now = new Date()): Promise<PendingAction> {
  const action = await showPendingAction(id);

  if (action.status === 'approved') {
    throw new PendingActionConflictError(
      `Pending action "${id}" has already executed.`,
      'ALREADY_EXECUTED',
    );
  }

  if (action.status === 'rejected') {
    throw new PendingActionConflictError(
      `Pending action "${id}" cannot be approved because it was rejected.`,
      'REJECTED',
    );
  }

  if (new Date(action.expires_at).getTime() <= now.getTime()) {
    throw new PendingActionConflictError(
      `Pending action "${id}" cannot be approved because it expired at ${action.expires_at}.`,
      'EXPIRED',
    );
  }

  return action;
}

export async function markPendingActionApproved(
  id: string,
  result: { comment_id: string | null; url: string | null },
  now = new Date(),
): Promise<PendingAction> {
  const actions = await readActions();
  const index = actions.findIndex(candidate => candidate.id === id);
  if (index === -1) throw new PendingActionNotFoundError(id);

  const action = actions[index];
  if (action.status !== 'pending') {
    throw new PendingActionConflictError(
      `Pending action "${id}" cannot be approved because its status is "${action.status}".`,
      action.status === 'approved' ? 'ALREADY_EXECUTED' : 'CONFLICT',
    );
  }

  const approved: PendingAction = {
    ...action,
    status: 'approved',
    executed_at: now.toISOString(),
    execution_result: result,
  };
  actions[index] = approved;
  await writeActions(actions);
  return approved;
}

export async function rejectPendingAction(id: string, now = new Date()): Promise<PendingAction> {
  const actions = await readActions();
  const index = actions.findIndex(candidate => candidate.id === id);
  if (index === -1) throw new PendingActionNotFoundError(id);

  const action = actions[index];
  if (action.status !== 'pending') {
    throw new PendingActionConflictError(
      `Pending action "${id}" cannot be rejected because its status is "${action.status}".`,
    );
  }

  const rejected: PendingAction = {
    ...action,
    status: 'rejected',
    rejected_at: now.toISOString(),
  };
  actions[index] = rejected;
  await writeActions(actions);
  return rejected;
}
