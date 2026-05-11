export type OutputFormat = 'json' | 'text';

/**
 * stdout 是否连接到终端。
 * 非 TTY 时 Agent 调用，默认 JSON；TTY 时人类调用，默认 text。
 */
export function isTTY(): boolean {
  return process.stdout.isTTY ?? false;
}

/**
 * 根据用户指定和 TTY 状态决定最终输出格式。
 * 优先级：显式指定 > TTY 检测默认值
 */
export function resolveFormat(requested?: string): OutputFormat {
  if (requested === 'json') return 'json';
  if (requested === 'text') return 'text';
  if (requested) {
    // 无效值，但不在这里处理 —— 由调用方验证
    return isTTY() ? 'text' : 'json';
  }
  return isTTY() ? 'text' : 'json';
}

/**
 * 校验 --output 参数值。
 * 返回 null 表示合法，否则返回错误信息。
 */
export function validateFormat(value: string): string | null {
  if (value === 'json' || value === 'text') return null;
  return `Invalid --output value "${value}". Expected one of: json, text.`;
}

/**
 * 格式化数据输出。
 *   json → 紧凑 JSON（单行）
 *   text → 人类可读文本
 * stdout 只输出这个结果，不含任何前缀。
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify(data);
  }
  return formatText(data);
}

function formatText(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  if (Array.isArray(data)) {
    return data.map(item => formatText(item)).join('\n');
  }
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${formatText(value)}`)
      .join('\n');
  }
  return String(data);
}

/**
 * 通过 stdout 输出命令结果。
 * 所有日志/警告/错误都不要用这个函数，用 stderr。
 */
export function printOutput(data: unknown, format: OutputFormat): void {
  const output = formatOutput(data, format);
  if (output) {
    process.stdout.write(output + '\n');
  }
}

/**
 * stderr 日志工具。
 * 用于进度、警告、诊断信息，永不污染 stdout。
 */
export const logger = {
  info: (msg: string) => process.stderr.write(`[info] ${msg}\n`),
  warn: (msg: string) => process.stderr.write(`[warn] ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[error] ${msg}\n`),
  debug: (msg: string) => process.stderr.write(`[debug] ${msg}\n`),
};

/**
 * 向 stderr 输出结构化错误并退出。
 */
export function fail(error: {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}, exitCode: number): never {
  const output = JSON.stringify({ error });
  process.stderr.write(output + '\n');
  process.exit(exitCode);
}
