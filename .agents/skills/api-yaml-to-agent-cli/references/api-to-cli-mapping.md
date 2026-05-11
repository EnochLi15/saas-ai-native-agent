# API YAML to Agent CLI Mapping

Use this reference when turning OpenAPI/Swagger YAML into an agent-friendly CLI contract.

## Parse These OpenAPI Fields

- `openapi` or `swagger`
- `info.title`, `info.version`
- `servers`
- `security`, `components.securitySchemes`
- `tags`
- `paths`
- HTTP methods under each path
- `operationId`
- `summary`, `description`
- path/query/header/cookie `parameters`
- `requestBody`
- response status codes and schemas
- `components.schemas`
- `deprecated`

Resolve `$ref` values far enough to understand inputs, outputs, enum values, required fields, and reusable error shapes.

## Resource Grouping

Prefer grouping by domain resource:

```text
GET /projects                  -> project list
POST /projects                 -> project create
GET /projects/{projectId}      -> project get <project-id>
PATCH /projects/{projectId}    -> project update <project-id>
DELETE /projects/{projectId}   -> project delete <project-id> --force
POST /projects/{projectId}/run -> project run <project-id>
```

Use tags as hints, not as the only source of truth. If tags are too broad, infer resources from paths and schemas.

## Verb Mapping

| API pattern | CLI verb |
| --- | --- |
| `GET /resources` | `list` |
| `GET /resources/{id}` | `get` |
| `POST /resources` | `create` |
| `PUT /resources/{id}` | `replace` or `update` |
| `PATCH /resources/{id}` | `update` |
| `DELETE /resources/{id}` | `delete` |
| `POST /resources/{id}:action` | `run` or action-specific verb |
| `GET /jobs/{id}` | `jobs get` or `<resource> status` |
| `GET /jobs/{id}/logs` | `jobs logs` or `<resource> logs` |

Prefer `update` over exposing both `put` and `patch` unless full replacement has materially different semantics.

## Arguments and Flags

- Path parameters become positional arguments.
- Query parameters become flags.
- Header parameters become flags only if users should set them directly; otherwise hide them behind config/auth.
- Required scalar body fields may become flags.
- Complex body objects should support `--input <file>` and `--input -` for stdin.
- Repeated fields should support repeatable flags or comma-separated values, but document the convention.
- Enum values must be validated before sending the request.
- Date/time fields should document accepted format and timezone assumptions.

## Output

Every data command must support `--json`.

Recommended output behavior:

- stdout: JSON result in `--json` mode
- stderr: logs, warnings, retries, progress
- default human output: table or concise summary when useful
- list output: array plus pagination metadata when available

Example list shape:

```json
{
  "items": [],
  "nextCursor": "opaque-token",
  "count": 0
}
```

## Pagination and Filtering

For any endpoint with pagination parameters, expose the API's native shape while keeping common aliases where possible:

- `--limit`
- `--cursor`
- `--page`
- `--page-size`
- `--sort`
- `--filter`
- `--since`
- `--until`

Default list commands must be bounded.

## Mutations and Safety

- `POST`, `PUT`, `PATCH`, and `DELETE` are mutating unless the API clearly says otherwise.
- Mutating commands should support `--dry-run` when the API offers validation, preview, or idempotent simulation.
- If dry run is not technically supported, document that API gap in the CLI spec.
- Destructive commands must require `--force` in non-interactive mode.
- Create commands should support caller-provided IDs or idempotency keys when the API supports them.

## Authentication and Profiles

Map auth schemes into CLI configuration:

- API key: profile secret or env var
- bearer token/OAuth: login/profile flow or env var
- basic auth: profile secret or env var

Avoid requiring credentials as regular command flags unless the repo already has that convention. Never print secrets in normal output.

## Error Mapping

Map API errors into structured CLI errors:

| HTTP status | Suggested exit |
| --- | --- |
| `400` | `2` usage or validation error |
| `401` / `403` | `5` auth failure |
| `404` | `3` not found |
| `409` | `4` conflict |
| `408` / `504` | `7` timeout |
| `429` | `6` dependency/rate-limit failure |
| `5xx` | `6` dependency failure |

Structured error shape:

```json
{
  "error": {
    "code": "not_found",
    "message": "Project not found.",
    "field": "projectId",
    "suggestion": "Run `tool project list --json` to find valid project IDs."
  }
}
```

## CLI Checklist

- [ ] Every command has a non-interactive path.
- [ ] Data commands support `--json`.
- [ ] stdout and stderr are separated.
- [ ] List/search/log outputs are bounded.
- [ ] Required fields and enum values are validated locally.
- [ ] Mutating commands define dry-run behavior or document the API gap.
- [ ] Destructive commands require `--force`.
- [ ] API errors map to stable CLI error codes and exit codes.
- [ ] Auth is handled through profiles, config, or environment variables.
- [ ] Examples include copy-pasteable agent commands.
