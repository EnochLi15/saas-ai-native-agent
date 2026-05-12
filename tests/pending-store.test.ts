import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCommentPendingAction,
  getApprovablePendingAction,
  listPendingActions,
  markPendingActionApproved,
  PendingActionConflictError,
  rejectPendingAction,
  showPendingAction,
} from '../src/lib/pending-store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'saas-agent-pending-'));
  process.env.SAAS_AGENT_PENDING_STORE = join(tempDir, 'pending-actions.json');
});

afterEach(async () => {
  delete process.env.SAAS_AGENT_PENDING_STORE;
  await rm(tempDir, { recursive: true, force: true });
});

describe('pending store', () => {
  it('creates a pending comment action with expiration metadata', async () => {
    const result = await createCommentPendingAction({
      issue: 'ENG-123',
      body: 'Suggested triage comment.',
      now: new Date('2026-05-12T10:00:00.000Z'),
    });

    expect(result.requires_confirmation).toBe(true);
    expect(result.pending_action_id).toMatch(/^act_/);
    expect(result.id).toBe(result.pending_action_id);
    expect(result.capability_id).toBe('linear.comment.propose');
    expect(result.issue_reference).toBe('ENG-123');
    expect(result.summary).toBe('Add a comment to ENG-123');
    expect(result.preview).toEqual({
      issue: 'ENG-123',
      body: 'Suggested triage comment.',
    });
    expect(result.expires_at).toBe('2026-05-13T10:00:00.000Z');
  });

  it('persists pending actions for list and show', async () => {
    const created = await createCommentPendingAction({
      issue: 'ENG-123',
      body: 'Comment body',
    });

    const list = await listPendingActions();
    expect(list.actions).toHaveLength(1);
    expect(list.actions[0].id).toBe(created.id);

    const shown = await showPendingAction(created.id);
    expect(shown.status).toBe('pending');
    expect(shown.parameters_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(shown.input).toEqual({
      issue: 'ENG-123',
      body: 'Comment body',
    });
  });

  it('rejects a pending action and removes it from pending list', async () => {
    const created = await createCommentPendingAction({
      issue: 'ENG-123',
      body: 'Comment body',
    });

    const rejected = await rejectPendingAction(created.id, new Date('2026-05-12T11:00:00.000Z'));
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejected_at).toBe('2026-05-12T11:00:00.000Z');

    const list = await listPendingActions();
    expect(list.actions).toEqual([]);
  });

  it('does not reject an already rejected action twice', async () => {
    const created = await createCommentPendingAction({
      issue: 'ENG-123',
      body: 'Comment body',
    });
    await rejectPendingAction(created.id);

    await expect(rejectPendingAction(created.id)).rejects.toBeInstanceOf(PendingActionConflictError);
  });

  it('marks an action approved and blocks duplicate approval', async () => {
    const created = await createCommentPendingAction({
      issue: 'ENG-123',
      body: 'Comment body',
    });

    const approved = await markPendingActionApproved(created.id, {
      comment_id: 'comment-1',
      url: 'https://linear.app/acme/comment/comment-1',
    });
    expect(approved.status).toBe('approved');
    expect(approved.execution_result).toEqual({
      comment_id: 'comment-1',
      url: 'https://linear.app/acme/comment/comment-1',
    });

    await expect(getApprovablePendingAction(created.id)).rejects.toMatchObject({
      code: 'ALREADY_EXECUTED',
    });
  });

  it('blocks rejected and expired actions from approval', async () => {
    const rejected = await createCommentPendingAction({
      issue: 'ENG-123',
      body: 'Comment body',
    });
    await rejectPendingAction(rejected.id);
    await expect(getApprovablePendingAction(rejected.id)).rejects.toMatchObject({
      code: 'REJECTED',
    });

    const expired = await createCommentPendingAction({
      issue: 'ENG-124',
      body: 'Comment body',
      now: new Date('2026-05-12T10:00:00.000Z'),
    });
    await expect(
      getApprovablePendingAction(expired.id, new Date('2026-05-13T10:00:00.000Z')),
    ).rejects.toMatchObject({
      code: 'EXPIRED',
    });
  });
});
