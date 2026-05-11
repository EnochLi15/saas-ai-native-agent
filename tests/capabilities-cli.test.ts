import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { ExitCode } from '../src/lib/exit-codes.js';

const tsx = './node_modules/.bin/tsx';

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const env = { ...process.env };
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

describe('saas-agent capabilities list', () => {
  it('returns JSON array of capabilities', () => {
    const { stdout, stderr, exitCode } = runCli(['capabilities', 'list', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.SUCCESS);
    expect(stderr).toBe('');

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.capabilities).toBeDefined();
    expect(Array.isArray(parsed.capabilities)).toBe(true);
    expect(parsed.capabilities.length).toBeGreaterThanOrEqual(3);
  });

  it('every item has id, name, description, risk, cli', () => {
    const { stdout } = runCli(['capabilities', 'list', '--output', 'json']);
    const parsed = JSON.parse(stdout.trim());

    for (const cap of parsed.capabilities) {
      expect(cap.id).toBeTruthy();
      expect(cap.name).toBeTruthy();
      expect(cap.description).toBeTruthy();
      expect(['read', 'write_propose', 'admin']).toContain(cap.risk);
      expect(cap.cli).toBeDefined();
      expect(cap.cli.command).toBeTruthy();
    }
  });

  it('includes read and write_propose capabilities', () => {
    const { stdout } = runCli(['capabilities', 'list', '--output', 'json']);
    const parsed = JSON.parse(stdout.trim());

    const risks = parsed.capabilities.map((c: { risk: string }) => c.risk);
    expect(risks).toContain('read');
    expect(risks).toContain('write_propose');
  });
});

describe('saas-agent capabilities show', () => {
  it('returns full capability detail as JSON', () => {
    const { stdout, exitCode } = runCli(['capabilities', 'show', 'linear.issue.get', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.id).toBe('linear.issue.get');
    expect(parsed.risk).toBe('read');
    expect(parsed.input_schema).toBeDefined();
    expect(parsed.output_schema).toBeDefined();
    expect(parsed.cli).toBeDefined();
  });

  it('returns NOT_FOUND for unknown capability', () => {
    const { stderr, exitCode } = runCli(['capabilities', 'show', 'nonexistent.foo', '--output', 'json']);
    expect(exitCode).toBe(ExitCode.NOT_FOUND);

    const parsed = JSON.parse(stderr.trim());
    expect(parsed.error.code).toBe('NOT_FOUND');
    expect(parsed.error.message).toContain('nonexistent.foo');
  });
});
