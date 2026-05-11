---
name: api-yaml-to-agent-cli
description: Convert api.yaml, openapi.yaml, Swagger, or OpenAPI interface documents into an agent-friendly CLI specification or implementation. Use when Codex needs to read API endpoint definitions, schemas, parameters, auth rules, pagination, errors, and operation IDs, then design or build a CLI that follows agent-friendly conventions such as predictable resource commands, non-interactive execution, JSON output, dry-run support, bounded list results, actionable errors, and stable exit codes.
---

# API YAML to Agent CLI

Use this skill to convert API interface documentation into a CLI surface that agents can discover, call, parse, retry, and audit.

## Workflow

1. Locate and parse the API document.
   - Find `api.yaml`, `openapi.yaml`, `swagger.yaml`, or equivalent files.
   - Prefer structured parsers for YAML/OpenAPI over ad hoc text extraction.
   - Resolve local `$ref` values when needed to understand request and response schemas.

2. Build an API inventory.
   - Extract base URL/server choices, security schemes, paths, methods, operation IDs, tags, parameters, request bodies, response schemas, pagination, error responses, and deprecation markers.
   - Group operations by stable resource concepts, not only by URL shape.
   - Identify ambiguous operations, missing schemas, side effects, and unsafe endpoints.

3. Map API operations to CLI commands.
   - Use resource-first commands with predictable verbs: `list`, `get`, `create`, `update`, `delete`, `run`, `status`, `logs`.
   - Prefer API `operationId` only when it is clearer than the resource-verb pattern.
   - Convert path parameters to positional arguments.
   - Convert query parameters to flags.
   - Convert request body fields to flags for simple bodies, or `--input <file>` / stdin for complex nested bodies.
   - Preserve required/optional distinctions and enum values.

4. Apply the agent-friendly CLI contract.
   - Support `--json` for data output.
   - Require non-interactive behavior.
   - Add `--limit`, cursor/page flags, filters, and time ranges for list/search/log operations.
   - Add `--dry-run` for mutating commands when the backend supports validation or preview; otherwise document the missing API support.
   - Add `--force` for destructive commands.
   - Define stdout/stderr separation, structured errors, stable exit codes, idempotency behavior, auth profile handling, and examples.
   - Read `references/api-to-cli-mapping.md` when detailed mapping rules are needed.

5. Implement when requested.
   - Reuse the repo's CLI framework, HTTP client, auth config, schema validation, and test style.
   - Generate code only when it matches the repo's conventions; otherwise write a clear spec first.
   - Avoid leaking tokens or secrets into generated examples, tests, or logs.
   - Prefer typed clients or generated schema types if the repo already uses them.

6. Verify.
   - Validate command definitions against the API spec.
   - Test required arguments, enum validation, JSON output, error mapping, pagination, dry runs, and destructive safeguards.
   - If possible, run commands against a mock server, local server, or safe staging environment.

## Output Shape

For a CLI specification, produce:

- API inventory summary
- resource and command tree
- argument and flag mapping
- input body strategy
- JSON output schemas
- error-code and exit-code mapping
- auth/profile behavior
- pagination and filtering behavior
- mutation safety rules
- examples for agents and humans
- implementation notes and unresolved API gaps

For implementation work, produce code changes plus tests and a concise mapping from API operations to CLI commands.

## References

- `references/api-to-cli-mapping.md`: detailed OpenAPI-to-CLI mapping rules and checklist.
