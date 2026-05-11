import { defineCommand } from 'citty';
import { resolveFormat, validateFormat, printOutput, fail, logger } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';
import { saveToken, getToken, deleteToken } from '../lib/auth-store.js';
import { validateLinearToken } from '../lib/linear-api.js';
import { isTTY } from '../lib/output.js';

/** 验证 provider 参数 */
function validateProvider(provider: string): string | null {
  if (!provider) return 'Provider is required.';
  if (provider !== 'linear') {
    return `Unknown provider "${provider}". Currently supported: linear.`;
  }
  return null;
}

export const authLoginCommand = defineCommand({
  meta: {
    name: 'login',
    description: 'Authenticate with a SaaS provider using a personal API key',
  },
  args: {
    provider: {
      type: 'positional',
      description: 'Provider name (e.g. linear)',
      required: true,
    },
    'token-stdin': {
      type: 'boolean',
      description: 'Read API key from stdin (required for non-TTY mode)',
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    if (args.output) {
      const validationError = validateFormat(args.output);
      if (validationError) {
        fail(
          { code: 'invalid_enum_value', message: validationError, field: 'output', suggestion: 'Use --output json or --output text.' },
          ExitCode.USAGE,
        );
      }
    }

    const providerError = validateProvider(args.provider);
    if (providerError) {
      fail({ code: 'VALIDATION_ERROR', message: providerError }, ExitCode.USAGE);
    }

    const format = resolveFormat(args.output);
    const provider = args.provider;

    // 获取 token
    let token: string;
    if (args['token-stdin']) {
      // 非交互模式：从 stdin 读取
      token = await readStdin();
      if (!token.trim()) {
        fail(
          { code: 'VALIDATION_ERROR', message: 'No token provided via stdin.' },
          ExitCode.USAGE,
        );
      }
      token = token.trim();
    } else {
      // 交互模式：仅 TTY
      if (!isTTY()) {
        fail(
          {
            code: 'VALIDATION_ERROR',
            message: 'Interactive login requires TTY. Use --token-stdin for non-interactive mode.',
            suggestion: 'echo "your-token" | saas-agent auth login linear --token-stdin',
          },
          ExitCode.USAGE,
        );
      }
      token = await promptToken(provider);
    }

    // 验证 token
    logger.info(`Validating ${provider} token...`);
    const result = await validateLinearToken(token);

    if (!result.valid || !result.viewer) {
      fail(
        {
          code: 'AUTH_INVALID',
          message: `The provided ${provider} token is invalid or expired.`,
          suggestion: 'Generate a new personal API key at https://linear.app/settings/api',
        },
        ExitCode.AUTH,
      );
    }

    // 存储 token
    await saveToken(provider, token);

    const output = {
      provider,
      authenticated: true,
      viewer: {
        id: result.viewer.id,
        name: result.viewer.name,
        email: result.viewer.email,
      },
    };
    printOutput(output, format);
  },
});

export const authStatusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Show authentication status for a provider',
  },
  args: {
    provider: {
      type: 'positional',
      description: 'Provider name (e.g. linear)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    if (args.output) {
      const validationError = validateFormat(args.output);
      if (validationError) {
        fail(
          { code: 'invalid_enum_value', message: validationError, field: 'output', suggestion: 'Use --output json or --output text.' },
          ExitCode.USAGE,
        );
      }
    }

    const providerError = validateProvider(args.provider);
    if (providerError) {
      fail({ code: 'VALIDATION_ERROR', message: providerError }, ExitCode.USAGE);
    }

    const format = resolveFormat(args.output);
    const provider = args.provider;

    const token = await getToken(provider);

    if (!token) {
      fail(
        {
          code: 'AUTH_REQUIRED',
          message: `Not authenticated with ${provider}. Run "saas-agent auth login ${provider}" to log in.`,
          suggestion: `saas-agent auth login ${provider} --token-stdin`,
        },
        ExitCode.AUTH,
      );
    }

    // 验证已有 token 是否仍然有效
    const result = await validateLinearToken(token);

    if (!result.valid || !result.viewer) {
      fail(
        {
          code: 'AUTH_INVALID',
          message: `The stored ${provider} token is no longer valid.`,
          suggestion: `Run "saas-agent auth logout ${provider}" and then "saas-agent auth login ${provider}" with a new key.`,
        },
        ExitCode.AUTH,
      );
    }

    // 不泄露 token
    const output = {
      provider,
      authenticated: true,
      viewer: {
        id: result.viewer.id,
        name: result.viewer.name,
        email: result.viewer.email,
      },
    };
    printOutput(output, format);
  },
});

export const authLogoutCommand = defineCommand({
  meta: {
    name: 'logout',
    description: 'Remove stored authentication for a provider',
  },
  args: {
    provider: {
      type: 'positional',
      description: 'Provider name (e.g. linear)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output format: json or text',
      valueHint: 'json|text',
    },
  },
  async run({ args }) {
    if (args.output) {
      const validationError = validateFormat(args.output);
      if (validationError) {
        fail(
          { code: 'invalid_enum_value', message: validationError, field: 'output', suggestion: 'Use --output json or --output text.' },
          ExitCode.USAGE,
        );
      }
    }

    const providerError = validateProvider(args.provider);
    if (providerError) {
      fail({ code: 'VALIDATION_ERROR', message: providerError }, ExitCode.USAGE);
    }

    const format = resolveFormat(args.output);
    const provider = args.provider;

    const token = await getToken(provider);

    if (!token) {
      fail(
        {
          code: 'AUTH_REQUIRED',
          message: `Not authenticated with ${provider}. Nothing to log out.`,
        },
        ExitCode.AUTH,
      );
    }

    await deleteToken(provider);

    const output = {
      provider,
      authenticated: false,
      message: `Logged out from ${provider}. Token removed from keychain.`,
    };
    printOutput(output, format);
  },
});

/** 从 stdin 读取（非交互模式） */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('readable', () => {
      let chunk: string | null;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

/** 在 TTY 下提示用户输入 token（不回显） */
function promptToken(provider: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 使用 stderr 输出提示，不污染 stdout
    process.stderr.write(`Enter ${provider} personal API key: `);

    // 使用 readline 的 question + muted 实现隐藏输入
    // Node 的 readline 不直接支持 muted，但可以通过 writeToOutput 覆盖
    const promptFn = (query: string): Promise<string> => {
      return new Promise((res) => {
        rl.question(query, (answer: string) => {
          res(answer);
        });
      });
    };

    promptFn('')
      .then((answer) => {
        rl.close();
        resolve(answer.trim());
      })
      .catch(() => {
        rl.close();
        resolve('');
      });

    // 覆盖输出以不回显
    rl._writeToOutput = function _writeToOutput(_char: string) {
      // 不显示输入内容
    };
  });
}
