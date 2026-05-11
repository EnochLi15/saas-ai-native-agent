import { defineCommand, runMain } from 'citty';
import { versionCommand } from './commands/version.js';

const main = defineCommand({
  meta: {
    name: 'saas-agent',
    version: '0.1.0',
    description: 'Agent-friendly SaaS operations CLI.\n\nRun commands against SaaS providers through a local semantic adapter.\nstdout is for command data. stderr is for logs, warnings, and errors.',
  },
  args: {
    output: {
      type: 'string',
      description: 'Output format: json or text. Default: json when non-TTY, text when TTY.',
      valueHint: 'json|text',
    },
  },
  subCommands: {
    version: versionCommand as never,
  },
});

// 非 TTY 下不输出欢迎信息到 stdout
// citty 的 help 和错误处理会自动路由到 stderr

runMain(main);
