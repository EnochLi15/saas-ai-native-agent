import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { ExitCode } from '../src/lib/exit-codes.js';

const tsx = './node_modules/.bin/tsx';

function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  const argList = args ? args.split(' ') : [];
  // vitest sets NODE_ENV=test + TEST=true, which consola uses to suppress output.
  // Remove them so the child process behaves as in production.
  const env = { ...process.env };
  delete env.NODE_ENV;
  delete env.TEST;
  delete env.VITEST;
  delete env.VITEST_MODE;
  delete env.VITEST_WORKER_ID;
  delete env.VITEST_POOL_ID;
  const result = spawnSync(tsx, ['src/main.ts', ...argList], {
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

describe('saas-agent version', () => {
  it('returns valid JSON with --output json', () => {
    const { stdout, stderr, exitCode } = runCli('version --output json');
    expect(exitCode).toBe(ExitCode.SUCCESS);

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.name).toBe('saas-agent');
    expect(parsed.version).toBe('0.1.0');
    // stdout 仅输出数据，不含日志
    expect(stderr).toBe('');
  });

  it('returns text output with --output text', () => {
    const { stdout, exitCode } = runCli('version --output text');
    expect(exitCode).toBe(ExitCode.SUCCESS);
    expect(stdout).toContain('name: saas-agent');
    expect(stdout).toContain('version: 0.1.0');
  });

  it('exits with code 2 for invalid --output value', () => {
    const { stderr, exitCode } = runCli('version --output yaml');
    expect(exitCode).toBe(ExitCode.USAGE);

    const parsed = JSON.parse(stderr.trim());
    expect(parsed.error.code).toBe('invalid_enum_value');
    expect(parsed.error.field).toBe('output');
  });
});

describe('saas-agent --help', () => {
  it('shows help and exits with code 0', () => {
    // citty 在 stdout 输出 help 信息（这是合理的 CLI 惯例）
    const { stdout, exitCode } = runCli('--help');
    expect(exitCode).toBe(ExitCode.SUCCESS);
    expect(stdout).toContain('saas-agent');
    expect(stdout).toContain('version');
    expect(stdout).toContain('--output');
  });
});

describe('exit codes', () => {
  it('exit code 0 on success', () => {
    const { exitCode } = runCli('version --output json');
    expect(exitCode).toBe(ExitCode.SUCCESS);
  });

  it('exit code 2 on invalid flag value', () => {
    const { exitCode } = runCli('version --output invalid');
    expect(exitCode).toBe(ExitCode.USAGE);
  });
});
