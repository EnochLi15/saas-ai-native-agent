# Agent-Friendly CLI Standard

Use this reference when converting web functionality into a CLI. If the target repo has its own CLI standard, follow the repo standard first and use this file only to fill gaps.

## Required Properties

- Commands must have a non-interactive path and must not hang when stdin is not a TTY.
- Data commands must support `--json`.
- stdout must contain command results; stderr must contain logs, progress, warnings, and diagnostics.
- List/search/log commands must have bounded output through `--limit`, pagination, filters, or time ranges.
- Mutating commands must support `--dry-run`.
- Destructive commands must require `--force` or an equivalent explicit confirmation.
- Errors must include a stable code, clear message, and recovery guidance.
- Exit codes must be stable and documented.
- Async operations must expose job IDs plus `status`, `logs`, and `wait` flows.
- Retry behavior must be idempotent or explicitly documented.

## Recommended Command Vocabulary

Use predictable resource-first commands:

```text
tool <resource> list
tool <resource> get <id>
tool <resource> create
tool <resource> update <id>
tool <resource> delete <id>
tool <resource> run <id>
tool <resource> status <id>
tool <resource> logs <id>
```

Prefer these verbs over inconsistent synonyms like `show`, `info`, `describe`, or `inspect` unless the distinction is important and documented.

## Standard Flags

| Flag | Purpose |
| --- | --- |
| `--json` | Emit JSON output. |
| `--format <json|table>` | Select output format when more than one is supported. |
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

## Baseline Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | General failure |
| `2` | Usage or validation error |
| `3` | Not found |
| `4` | Conflict or already exists |
| `5` | Authentication or authorization failure |
| `6` | Network or dependency failure |
| `7` | Timeout |

## Structured Error Shape

Use this shape, adapted to the target language/framework:

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

## Web-to-CLI Mapping Checklist

- Map every primary page to one or more resources.
- Map every form submit to `create`, `update`, `run`, or `delete`.
- Map every table/list view to `list` with filters, sorting, and pagination.
- Map every detail page to `get`.
- Map every modal action to an explicit command or flag.
- Map background operations to jobs with `status`, `logs`, and `wait`.
- Mark destructive actions and require `--force`.
- Mark validation rules and expose them as CLI argument validation.
- Prefer discovered API endpoints over browser automation in the final CLI.
- Document any workflow that cannot be made reliable without product/API changes.
