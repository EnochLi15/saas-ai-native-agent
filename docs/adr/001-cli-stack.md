# ADR 001: CLI Stack and Packaging Target

- **Status:** Accepted
- **Date:** 2026-05-11
- **Deciders:** EnochLi15

## Context

The saas-agent CLI is the core delivery artifact for the project. It must:

1. Produce a single installable artifact that agents can invoke directly.
2. Support dynamic subcommand routing: `saas-agent <provider> <resource> <action>`.
3. Output structured JSON for agents when stdout is not a TTY.
4. Never prompt interactively — all confirmations go through `propose → approve`.
5. Parse YAML capability manifests and validate input/output against JSON Schema.
6. Store auth tokens in the OS keychain, never in plaintext.
7. Call Linear's GraphQL API as the reference connector, with room for future SaaS connectors.
8. Run primarily on macOS (developer machines), with Linux as a secondary target.

## Decision

**Language:** TypeScript
**Runtime:** Node.js 20 LTS
**Package manager:** npm
**Command framework:** [citty](https://github.com/unjs/citty)
**Test runner:** [Vitest](https://vitest.dev/)
**Distribution:** `npm install -g saas-agent` / `npx saas-agent`

### Dependency matrix

| Concern | Library |
|---|---|
| CLI framework | citty |
| GraphQL client | graphql-request |
| YAML parsing | js-yaml |
| JSON Schema validation | ajv |
| Keychain access | keytar |

## Rationale

**Node.js is near-universal on developer machines.** `npx saas-agent <command>` gives agents a zero-install invocation path. `npm install -g` covers persistent installations.

**citty provides type-safe command definitions** that map naturally to the capability manifest model. Its `defineCommand` schema is close in shape to the manifest structure (id, args, run), enabling manifest-driven command generation in future milestones.

**TypeScript** gives type safety across command schemas, API contracts, and manifest parsing without additional tooling.

**keytar** is the established cross-platform keychain library in the Node ecosystem, supporting macOS Keychain, Windows Credential Manager, and Linux libsecret.

## Alternatives considered

| Option | Rejected because |
|---|---|
| Go + Cobra | Team preference for TypeScript; npm ecosystem aligns better with existing skills |
| Bun runtime | Added runtime dependency that is less universal than Node.js; `bun build --compile` still maturing |
| Deno / cliffy | Smaller ecosystem; fewer developers have it installed |
| Commander.js | Less type-safe than citty; manual subcommand registration |
| Python / Click | No single-binary path; runtime fragmentation |

## Consequences

- The project requires Node.js 20+ on developer machines.
- `libsecret` (Linux) or equivalent must be present for keytar to work on Linux.
- `npx` cold-start latency is acceptable for agent invocation patterns (single command, not a server).
- Future MCP server work can reuse the same TypeScript modules (connectors, manifest parser, auth).
