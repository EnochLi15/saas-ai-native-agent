import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeAuditLog } from '../src/lib/audit-log.js';

let tempDir: string;
let auditLogFile: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'saas-agent-audit-'));
  auditLogFile = join(tempDir, 'audit-log.jsonl');
  process.env.SAAS_AGENT_AUDIT_LOG = auditLogFile;
});

afterEach(async () => {
  delete process.env.SAAS_AGENT_AUDIT_LOG;
  await rm(tempDir, { recursive: true, force: true });
});

describe('audit log', () => {
  it('appends local audit entries without token fields', async () => {
    await writeAuditLog({
      timestamp: '2026-05-12T10:00:00.000Z',
      provider: 'linear',
      capability_id: 'linear.comment.propose',
      pending_action_id: 'act_123',
      status: 'approved',
      summary: 'Add a comment to ENG-123',
      result: {
        comment_id: 'comment-1',
        url: 'https://linear.app/acme/comment/comment-1',
      },
    });

    const raw = await readFile(auditLogFile, 'utf-8');
    const parsed = JSON.parse(raw.trim());
    expect(parsed.pending_action_id).toBe('act_123');
    expect(raw).not.toContain('token');
    expect(raw).not.toContain('gho_');
  });
});
