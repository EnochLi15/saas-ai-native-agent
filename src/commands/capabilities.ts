import { defineCommand } from 'citty';
import { resolveFormat, validateFormat, printOutput, fail } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';
import { listCapabilities, getCapability } from '../lib/manifest-loader.js';

export const capabilitiesListCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List all available capabilities',
  },
  args: {
    output: {
      type: 'string',
      description: 'Output format: json or text. Default: json when non-TTY, text when TTY.',
      valueHint: 'json|text',
    },
  },
  run({ args }) {
    if (args.output) {
      const validationError = validateFormat(args.output);
      if (validationError) {
        fail(
          {
            code: 'invalid_enum_value',
            message: validationError,
            field: 'output',
            suggestion: 'Use --output json or --output text.',
          },
          ExitCode.USAGE,
        );
      }
    }

    const format = resolveFormat(args.output);
    const capabilities = listCapabilities();

    if (format === 'json') {
      printOutput({ capabilities }, format);
    } else {
      // 人类可读表格
      for (const cap of capabilities) {
        printOutput(
          { id: cap.id, risk: cap.risk, cli: cap.cli.command, description: cap.description },
          format,
        );
        // 每个 capability 之间空一行
        process.stdout.write('\n');
      }
    }
  },
});

export const capabilitiesShowCommand = defineCommand({
  meta: {
    name: 'show',
    description: 'Show details for a specific capability',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Capability id (e.g. linear.team.search)',
      required: true,
    },
    output: {
      type: 'string',
      description: 'Output format: json or text. Default: json when non-TTY, text when TTY.',
      valueHint: 'json|text',
    },
  },
  run({ args }) {
    if (args.output) {
      const validationError = validateFormat(args.output);
      if (validationError) {
        fail(
          {
            code: 'invalid_enum_value',
            message: validationError,
            field: 'output',
            suggestion: 'Use --output json or --output text.',
          },
          ExitCode.USAGE,
        );
      }
    }

    const format = resolveFormat(args.output);
    const capability = getCapability(args.id);

    if (!capability) {
      fail(
        {
          code: 'NOT_FOUND',
          message: `Capability "${args.id}" not found. Use "saas-agent capabilities list" to see available capabilities.`,
          suggestion: 'saas-agent capabilities list --output json',
        },
        ExitCode.NOT_FOUND,
      );
    }

    printOutput(capability, format);
  },
});
