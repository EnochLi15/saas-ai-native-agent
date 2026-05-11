import { defineCommand } from 'citty';
import { resolveFormat, validateFormat, printOutput, fail } from '../lib/output.js';
import { ExitCode } from '../lib/exit-codes.js';

export const versionCommand = defineCommand({
  meta: {
    name: 'version',
    description: 'Show version information',
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
    const info = {
      name: 'saas-agent',
      version: '0.1.0',
    };
    printOutput(info, format);
  },
});
