# Linear Triage Skill

## Purpose

Use this skill when an Agent needs to inspect Linear issues, identify triage risks, draft follow-up comments, and write back only after explicit user approval.

The Agent operates through the local `saas-agent` CLI. It does not require MCP, a daemon, browser automation, or a cloud control plane.

## Available CLI Capabilities

Read commands may run directly:

```bash
saas-agent capabilities list --output json
saas-agent capabilities show linear.issue.search --output json
saas-agent linear team search --query <team-name-or-key> --output json
saas-agent linear issue search --team <team-key-or-id> --status <state> --limit 20 --output json
saas-agent linear issue get <id-or-identifier> --output json
```

Comment writeback must use the pending action flow:

```bash
saas-agent linear comment propose --issue <id-or-identifier> --body-file comment.md --output json
saas-agent pending list --output json
saas-agent pending show <pending-action-id> --output json
saas-agent pending approve <pending-action-id> --output json
saas-agent pending reject <pending-action-id> --output json
```

Never write a Linear comment directly. `linear.comment.propose` creates a local pending action only. `pending approve` is the only command that may execute the Linear comment mutation.

## Recommended Workflow

1. Confirm authentication state or ask the user to authenticate:

```bash
saas-agent auth status linear --output json
```

2. Discover the team:

```bash
saas-agent linear team search --query platform --limit 20 --output json
```

3. Search a bounded issue set:

```bash
saas-agent linear issue search --team PLAT --status "Todo" --limit 20 --output json
```

Use filters such as `--assignee`, `--label`, `--updated-before`, `--updated-after`, and `--cursor` to keep the scope precise.

4. Inspect details before making recommendations:

```bash
saas-agent linear issue get PLAT-123 --output json
```

5. Produce a triage summary for the user. Include the issue identifier, observed risk, evidence, and recommended next step.

6. Draft comments only for issues where a writeback is useful. Save each comment to a file or pass it through `--body`.

```bash
saas-agent linear comment propose --issue PLAT-123 --body-file comment.md --output json
```

7. Ask the user to confirm. If approved, execute the pending action:

```bash
saas-agent pending approve act_123 --output json
```

If the user declines, reject it:

```bash
saas-agent pending reject act_123 --output json
```

## Triage Heuristics

Flag stale issues when:

- `updated_at` is older than the team's expected response window.
- The latest comments ask for follow-up but no owner has responded.
- Status is active, but there is no recent evidence of progress.

Flag blocked issues when:

- Labels include `blocked`, `waiting`, `dependency`, or similar terms.
- The title, description, or comments mention blockers, missing decisions, unavailable reviewers, or dependent work.
- The next step depends on a named person or team that has not responded.

Flag unowned issues when:

- `assignee` is null.
- The issue has a high priority and no clear owner in the description or comments.
- Ownership appears stale because the assignee was asked a question but has not replied.

Flag unclear issues when:

- The title or description does not explain user impact, expected behavior, reproduction steps, or success criteria.
- The issue asks for broad work without a concrete next action.
- The comments show confusion about scope, priority, or ownership.

Flag high-priority risks when:

- `priority` is High, Urgent, or equivalent.
- The issue affects production, security, data loss, billing, or a release blocker.
- A high-priority issue is stale, blocked, or unowned.

Do not recommend closing an issue unless the user explicitly asks for closure recommendations.

## Comment Writing Guidelines

Write concise, useful comments that help the Linear issue move forward.

Good comments include:

- The observed triage signal.
- The specific missing decision, owner, reproduction detail, or next step.
- A direct question or proposed next action.
- Neutral wording and no blame.

Avoid:

- Long summaries of everything in the issue.
- Speculation without evidence.
- Multiple unrelated asks in one comment.
- Claims that the Agent performed work it did not perform.

Example:

```text
This looks blocked on an owner decision: the issue is high priority, has no assignee, and has not been updated since 2026-05-01. Can someone confirm the current owner or whether this should move back to triage?
```

## Confirmation Policy

Read commands may execute without confirmation.

Writeback always requires:

1. A preview created by `saas-agent linear comment propose`.
2. User confirmation outside the CLI.
3. Execution through `saas-agent pending approve`.

User skill overrides may adjust triage rules, stale thresholds, wording, and issue selection. Overrides cannot bypass pending action safety, cannot call Linear write mutations directly, and cannot treat propose as approval.

## Agent Output Format

When reporting triage results, use this structure:

```text
Summary:
- Scope inspected
- Main risks

Issues:
- PLAT-123: status, risk, evidence, recommended next step
- PLAT-456: status, risk, evidence, recommended next step

Proposed Comments:
- PLAT-123: pending_action_id, preview summary

Confirmation:
- Ask whether to approve or reject each pending action
```

## Failure Handling

If auth fails with `AUTH_REQUIRED`, ask the user to run:

```bash
saas-agent auth login linear --token-stdin
```

If a team or issue is not found, narrow the query and retry with the exact key, id, or identifier.

If a search response has `page_info.has_next_page: true`, continue with `--cursor <end_cursor>` only when the user wants a broader scope.

If `pending approve` fails because an action is expired, rejected, or already executed, do not retry approval blindly. Show the structured error and propose creating a fresh pending action if the user still wants the writeback.

If the Linear API returns an error, preserve stdout/stderr separation, report the structured error code, and avoid exposing tokens or secrets.
