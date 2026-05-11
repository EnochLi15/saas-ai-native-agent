export const ExitCode = {
  SUCCESS: 0,
  GENERAL_FAILURE: 1,
  USAGE: 2,
  NOT_FOUND: 3,
  CONFLICT: 4,
  AUTH: 5,
  NETWORK: 6,
  TIMEOUT: 7,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
