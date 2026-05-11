# Agent-Friendly CLI Guide

This guide defines how this project should design command-line interfaces that are easy for AI agents, scripts, CI, and humans to discover, call, parse, retry, and audit.

Agent-friendly CLI design is not about adding AI-branded text to a tool. It means treating the CLI as a stable machine interface with good human ergonomics layered on top.

## Goals

- Agents can discover what the CLI can do without reading source code.
- Commands can run safely in non-interactive shells.
- Outputs are easy to parse and bounded in size.
- Errors explain what failed and how to recover.
- Mutating operations can be previewed, retried, and audited.

## Core Principles

### 1. Default to non-interactive execution

Commands must not hang waiting for prompts when stdin is not a TTY.

Use explicit flags for automation:

- `--non-interactive` or `--no-input`
- `--yes` for confirmations
- `--force` for destructive operations
- `--quiet` for reduced logs

Interactive flows may exist, but every interactive workflow should have an equivalent flag-driven path.

### 2. Provide structured output

Any command that returns data should support machine-readable output.

Preferred convention:

```bash
tool resource list --json
tool resource get <id> --json
```

Rules:

- stdout is for the requested result.
- stderr is for logs, warnings, progress, and diagnostics.
- JSON field names should be stable.
- Prefer arrays/objects over table-shaped strings when `--json` is used.

### 3. Keep output bounded

Agents should never need to parse unbounded output by default.

List, search, and log commands should support:

- `--limit`
- `--page` or `--cursor`
- `--since` / `--until` where time is relevant
- `--filter` or resource-specific filters

If output is truncated, the command should say how to retrieve the next page.

### 4. Make help and introspection machine-readable

Human help is required, but agents also benefit from structured introspection.

Minimum:

```bash
tool --help
tool <command> --help
```

Recommended:

```bash
tool introspect --json
tool agent-context --json
```

The structured form should include:

- command names
- descriptions
- arguments
- flags
- required fields
- default values
- enum values
- examples
- exit code meanings

### 5. Use predictable command vocabulary

Prefer common verbs and consistent resource naming.

Use:

- `list`
- `get`
- `create`
- `update`
- `delete`
- `run`
- `status`
- `logs`

Avoid using several words for the same operation, such as mixing `show`, `info`, and `describe` without a clear distinction.

### 6. Make errors actionable

Errors should tell the caller what happened, why it happened, and what to do next.

Weak:

```text
invalid value
```

Better:

```text
Invalid --format value "yaml". Expected one of: json, table.
Try: tool jobs list --format json
```

For `--json` mode, errors should also support structured output:

```json
{
  "error": {
    "code": "invalid_enum_value",
    "message": "Invalid --format value.",
    "field": "format",
    "expected": ["json", "table"],
    "received": "yaml",
    "suggestion": "Use --format json."
  }
}
```

### 7. Use stable exit codes

Document exit code meanings.

Recommended baseline:

- `0`: success
- `1`: general failure
- `2`: usage or validation error
- `3`: not found
- `4`: conflict or already exists
- `5`: authentication or authorization failure
- `6`: network or dependency failure
- `7`: timeout

Do not rely on human-readable error strings as the only way to classify failures.

### 8. Support dry runs for mutations

Commands that create, update, delete, deploy, migrate, or otherwise mutate state should support:

```bash
tool resource update <id> --dry-run --json
```

Dry-run output should explain:

- what would change
- what would be created or deleted
- which external systems would be touched
- whether the operation appears safe to apply

### 9. Make retries safe

Agents often retry after transient failures. Avoid making retries dangerous.

Prefer:

- idempotent create/update operations where practical
- caller-provided IDs or idempotency keys
- conflict responses that include the existing resource ID
- clear distinction between "already exists" and "created"

### 10. Treat destructive actions as explicit

Destructive commands should require an explicit confirmation flag in non-interactive mode.

Example:

```bash
tool resource delete <id> --force
```

For broad destructive operations, require a narrow selector or an additional confirmation token.

### 11. Support async jobs directly

If a command starts a long-running job, return a job ID and provide first-class job commands.

Recommended shape:

```bash
tool deploy start --json
tool jobs list --json --limit 20
tool jobs get <job-id> --json
tool jobs logs <job-id> --json --limit 200
tool jobs wait <job-id> --timeout 10m --json
```

For common automation flows, support:

```bash
tool deploy start --wait --timeout 10m --json
```

### 12. Support profiles and persistent configuration

Agents should not have to repeat a long list of flags in every command.

Recommended shape:

```bash
tool profiles list --json
tool profiles get <name> --json
tool profiles save <name> --json
tool <command> --profile <name>
```

Never hide security-sensitive values in normal output.

## Command Design Checklist

Use this checklist before adding or changing any CLI command.

- [ ] The command has a non-interactive path.
- [ ] The command does not prompt or hang when stdin is not a TTY.
- [ ] Data output supports `--json`.
- [ ] stdout contains only the command result in structured modes.
- [ ] stderr contains logs, warnings, and diagnostics.
- [ ] Errors include a stable code and recovery guidance.
- [ ] Exit codes are documented and stable.
- [ ] List/search/log commands support limits and pagination.
- [ ] Mutating commands support `--dry-run`.
- [ ] Destructive commands require `--force` or equivalent.
- [ ] Retry behavior is safe or clearly documented.
- [ ] Long-running operations return job IDs.
- [ ] Async flows support `--wait`, `status`, and `logs`.
- [ ] Help examples include copy-pasteable commands.
- [ ] Machine-readable introspection exists or is planned.

## Suggested Standard Flags

Use these names unless the surrounding ecosystem has a stronger convention.

| Flag | Purpose |
| --- | --- |
| `--json` | Emit JSON output. |
| `--format <json|table>` | Select output format when multiple human formats are needed. |
| `--limit <n>` | Bound result size. |
| `--cursor <token>` | Continue paginated results. |
| `--filter <expr>` | Filter resources. |
| `--dry-run` | Preview a mutation without applying it. |
| `--non-interactive` | Disable prompts. |
| `--yes` | Answer yes to safe confirmations. |
| `--force` | Confirm destructive or overwrite behavior. |
| `--quiet` | Reduce non-result output. |
| `--wait` | Wait for an async operation to complete. |
| `--timeout <duration>` | Bound waiting time. |
| `--profile <name>` | Use a saved configuration profile. |

## Documentation Requirements

Each CLI command should document:

- purpose
- required arguments
- important flags
- examples for human use
- examples for agent/script use with `--json`
- exit codes
- error codes
- side effects
- idempotency or retry behavior

Architecture documents that introduce CLIs should include how the CLI satisfies this guide.

## References

- [ACLI: Agent-friendly CLI Specification and SDKs](https://alpibrusl.github.io/acli/)
- [The CLI Spec](https://clispec.dev/)
- [Making your CLI agent-friendly](https://www.speakeasy.com/blog/engineering-agent-friendly-cli)
- [10 Principles for Agent-Native CLIs](https://trevinsays.com/p/10-principles-for-agent-native-clis)
