import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExitCode } from '../src/lib/exit-codes.js';

const tsx = './node_modules/.bin/tsx';
let tempDir: string;
let storeFile: string;

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const env = { ...process.env, SAAS_AGENT_PENDING_STORE: storeFile };
  delete env.NODE_ENV;
  delete env.TEST;
  delete env.VITEST;
  delete env.VITEST_MODE;
  delete env.VITEST_WORKER_ID;
  delete env.VITEST_POOL_ID;

  const result = spawnSync(tsx, ['src/main.ts', ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10_000,
    env,
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? ExitCode.GENERAL_FAILURE,
  };
}

async function seedStore(status = 'pending', expiresAt = '2026-05-13T10:00:00.000Z') {
  await writeFile(
    storeFile,
    JSON.stringify({
      actions: [
        {
          id: 'act_test123',
          provider: 'linear',
          capability_id: 'linear.comment.propose',
          status,
          summary: 'Add a comment to ENG-123',
          issue_reference: 'ENG-123',
          preview: { issue: 'ENG-123', body: 'Looks actionable.' },
          input: { issue: 'ENG-123', body: 'Looks actionable.' },
          parameters_hash: '0'.repeat(64),
          created_at: '2026-05-12T10:00:00.000Z',
          expires_at: expiresAt,
        },
      ],
    }),
    'utf-8',
  );
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'saas-agent-pending-cli-'));
  storeFile = join(tempDir, 'pending-actions.json');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('saas-agent pending', () => {
  it('lists pending actions as JSON', async () => {
    await seedStore();

    const { stdout, stderr, exitCode } = runCli(['pending', 'list', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.SUCCESS);
    expect(stderr).toBe('');

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0].id).toBe('act_test123');
  });

  it('shows a pending action by id', async () => {
    await seedStore();

    const { stdout, exitCode } = runCli(['pending', 'show', 'act_test123', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.id).toBe('act_test123');
    expect(parsed.preview.body).toBe('Looks actionable.');
  });

  it('rejects a pending action by id', async () => {
    await seedStore();

    const { stdout, exitCode } = runCli(['pending', 'reject', 'act_test123', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.id).toBe('act_test123');
    expect(parsed.status).toBe('rejected');

    const list = runCli(['pending', 'list', '--output', 'json']);
    expect(JSON.parse(list.stdout.trim()).actions).toEqual([]);
  });

  it('returns AUTH_REQUIRED for an approvable action when not logged in', async () => {
    await seedStore();

    const { stderr, exitCode } = runCli(['pending', 'approve', 'act_test123', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.AUTH);

    const parsed = JSON.parse(stderr.trim());
    expect(parsed.error.code).toBe('AUTH_REQUIRED');
  });

  it('blocks rejected actions before auth lookup', async () => {
    await seedStore('rejected');

    const { stderr, exitCode } = runCli(['pending', 'approve', 'act_test123', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.CONFLICT);

    const parsed = JSON.parse(stderr.trim());
    expect(parsed.error.code).toBe('REJECTED');
  });

  it('blocks expired actions before auth lookup', async () => {
    await seedStore('pending', '2000-01-01T00:00:00.000Z');

    const { stderr, exitCode } = runCli(['pending', 'approve', 'act_test123', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.CONFLICT);

    const parsed = JSON.parse(stderr.trim());
    expect(parsed.error.code).toBe('EXPIRED');
  });

  it('blocks already approved actions before auth lookup', async () => {
    await seedStore('approved');

    const { stderr, exitCode } = runCli(['pending', 'approve', 'act_test123', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.CONFLICT);

    const parsed = JSON.parse(stderr.trim());
    expect(parsed.error.code).toBe('ALREADY_EXECUTED');
  });
});
