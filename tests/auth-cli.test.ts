import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { ExitCode } from '../src/lib/exit-codes.js';

const tsx = './node_modules/.bin/tsx';

function runCli(args: string[], input?: string): { stdout: string; stderr: string; exitCode: number } {
  const env = { ...process.env };
  delete env.NODE_ENV;
  delete env.TEST;
  delete env.VITEST;
  delete env.VITEST_MODE;
  delete env.VITEST_WORKER_ID;
  delete env.VITEST_POOL_ID;

  const result = spawnSync(tsx, ['src/main.ts', ...args], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15_000,
    env,
    input,
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? ExitCode.GENERAL_FAILURE,
  };
}

/** 解析 stderr 中最后一行的 JSON 错误（忽略日志行） */
function parseErrorFromStderr(stderr: string): Record<string, unknown> {
  const lines = stderr.trim().split('\n');
  // 取最后一个有效的 JSON 行（跳过 [info] 等日志行）
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{')) {
      return JSON.parse(line);
    }
  }
  throw new Error(`No JSON found in stderr: ${stderr}`);
}

describe('saas-agent auth', () => {
  describe('login --token-stdin', () => {
    it('rejects invalid token with AUTH_INVALID', async () => {
      const { stderr, exitCode } = runCli(
        ['auth', 'login', 'linear', '--token-stdin', '--output', 'json'],
        'invalid-token-value\n',
      );
      expect(exitCode).toBe(ExitCode.AUTH);

      const parsed = parseErrorFromStderr(stderr);
      expect(parsed.error.code).toBe('AUTH_INVALID');
    }, 15_000);

    it('rejects empty input', () => {
      const { stderr, exitCode } = runCli(
        ['auth', 'login', 'linear', '--token-stdin', '--output', 'json'],
        '\n',
      );
      expect(exitCode).toBe(ExitCode.USAGE);

      const parsed = parseErrorFromStderr(stderr);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
      expect(parsed.error.message).toContain('No token');
    });
  });

  describe('status', () => {
    it('returns AUTH_REQUIRED when not logged in', () => {
      const { stderr, exitCode } = runCli(['auth', 'status', 'linear', '--output', 'json']);
      expect(exitCode).toBe(ExitCode.AUTH);

      const parsed = parseErrorFromStderr(stderr);
      expect(parsed.error.code).toBe('AUTH_REQUIRED');
      expect(parsed.error.message).toContain('Not authenticated');
    });
  });

  describe('logout', () => {
    it('returns AUTH_REQUIRED when not logged in', () => {
      const { stderr, exitCode } = runCli(['auth', 'logout', 'linear', '--output', 'json']);
      expect(exitCode).toBe(ExitCode.AUTH);

      const parsed = parseErrorFromStderr(stderr);
      expect(parsed.error.code).toBe('AUTH_REQUIRED');
      expect(parsed.error.message).toContain('Not authenticated');
    });
  });

  describe('unknown provider', () => {
    it('rejects login with unknown provider', () => {
      const { stderr, exitCode } = runCli(
        ['auth', 'login', 'unknown', '--token-stdin', '--output', 'json'],
        'some-token\n',
      );
      expect(exitCode).toBe(ExitCode.USAGE);

      const parsed = parseErrorFromStderr(stderr);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
      expect(parsed.error.message).toContain('Unknown provider');
    });

    it('rejects status with unknown provider', () => {
      const { stderr, exitCode } = runCli(['auth', 'status', 'unknown', '--output', 'json']);
      expect(exitCode).toBe(ExitCode.USAGE);

      const parsed = parseErrorFromStderr(stderr);
      expect(parsed.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
