import { defineCommand, runMain } from 'citty';
import { versionCommand } from './commands/version.js';
import { capabilitiesListCommand, capabilitiesShowCommand } from './commands/capabilities.js';
import { authLoginCommand, authStatusCommand, authLogoutCommand } from './commands/auth.js';
import { teamSearchCommand } from './commands/linear.js';

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
    capabilities: defineCommand({
      meta: {
        name: 'capabilities',
        description: 'Inspect available capabilities',
      },
      subCommands: {
        list: capabilitiesListCommand as never,
        show: capabilitiesShowCommand as never,
      },
    }) as never,
    auth: defineCommand({
      meta: {
        name: 'auth',
        description: 'Manage provider authentication',
      },
      subCommands: {
        login: authLoginCommand as never,
        status: authStatusCommand as never,
        logout: authLogoutCommand as never,
      },
    }) as never,
    linear: defineCommand({
      meta: {
        name: 'linear',
        description: 'Linear operations',
      },
      subCommands: {
        team: defineCommand({
          meta: {
            name: 'team',
            description: 'Team operations',
          },
          subCommands: {
            search: teamSearchCommand as never,
          },
        }) as never,
      },
    }) as never,
  },
});

// 非 TTY 下不输出欢迎信息到 stdout
// citty 的 help 和错误处理会自动路由到 stderr

runMain(main);
