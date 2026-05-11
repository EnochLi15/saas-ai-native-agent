---
name: web-to-agent-cli
description: Convert web application functionality into an agent-friendly CLI by browsing and testing pages with Playwright. Use when Codex needs to inspect a web UI, infer workflows, forms, actions, resources, tables, authentication needs, network calls, and state transitions, then design or implement a CLI that follows agent-friendly CLI conventions such as non-interactive operation, JSON output, dry-run support, bounded results, actionable errors, and stable exit codes.
---

# Web to Agent CLI

Use this skill to turn a working web page or web app into a CLI surface that agents can call reliably.

## Workflow

1. Clarify the target.
   - Identify the URL, local dev command, auth/session requirements, and whether the user wants a CLI specification, implementation, tests, or all three.
   - If the app is local and no server is running, start the existing dev server according to the repo's conventions.

2. Browse with Playwright.
   - Use Playwright to inspect the app like a user: navigation, forms, buttons, menus, tables, detail pages, modals, empty states, errors, and success states.
   - Capture screenshots or traces when they help preserve evidence.
   - Observe network requests and response shapes where possible; prefer underlying API contracts over brittle DOM scraping.
   - Keep credentials, tokens, cookies, and private data out of generated docs and examples.

3. Build a capability inventory.
   - List resources, actions, required inputs, optional inputs, filters, pagination, output fields, validation rules, side effects, async jobs, and destructive operations.
   - Distinguish user-facing workflows from stable backend capabilities.
   - Note gaps where the UI does not expose enough information for a reliable CLI.

4. Design the CLI.
   - Map web resources to predictable commands: `list`, `get`, `create`, `update`, `delete`, `run`, `status`, `logs`.
   - Require non-interactive paths for all commands.
   - Add `--json` for data output, `--dry-run` for mutations, `--force` for destructive operations, `--limit` or pagination for unbounded results, and `--wait` for async workflows.
   - Define stdout/stderr behavior, stable exit codes, structured error codes, idempotency rules, and examples.
   - Read `references/agent-friendly-cli-standard.md` when the project does not already provide a stronger local standard.

5. Implement when requested.
   - Reuse the repo's existing language, CLI framework, auth helpers, API clients, and test patterns.
   - Prefer calling stable APIs discovered through Playwright/network inspection. Use browser automation inside the CLI only as a last resort and name that fragility explicitly.
   - Add focused tests for parsing, non-interactive behavior, JSON output, validation errors, dry runs, pagination, and destructive safeguards.

6. Verify.
   - Run the CLI commands against a safe local or staging target.
   - Confirm JSON is parseable, output is bounded, stderr/stdout are separated, and failures return documented exit codes.
   - If implementing browser-backed commands, run Playwright tests that cover the browser workflow.

## Output Shape

For a CLI specification, produce:

- capability inventory
- proposed command tree
- flags and arguments
- JSON output schemas
- error and exit-code table
- mutation safety rules
- examples for agents and humans
- implementation notes and open questions

For implementation work, produce the code changes, tests, and a short mapping from web workflow to CLI commands.

## Playwright Notes

- Prefer semantic locators (`getByRole`, `getByLabel`, `getByText`) over CSS selectors.
- Use traces, screenshots, console logs, and request/response inspection to understand behavior.
- Test narrow workflows one at a time before generalizing.
- Treat flaky UI timing as a signal to look for underlying API contracts.

## References

- `references/agent-friendly-cli-standard.md`: local checklist for the CLI design contract.
