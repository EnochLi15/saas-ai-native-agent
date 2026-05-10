# Linear Reference Connector 架构设计方案

## 1. 背景

Linear 是第一版 reference SaaS，用来验证端侧 SaaS Semantic CLI 的核心假设：

> 不改造 SaaS，通过本地语义 CLI + Agent skill，即可让外部端侧 Agent 完成一个真实业务 workflow。

Linear 适合作为第一版对象，因为它 API 现代、对象模型清晰、研发团队用户容易理解，且 triage workflow 适合 Agent 发挥判断和总结能力。

## 2. 第一版目标

第一版只验证一个闭环：

```text
读取 Linear issue -> Agent 分析 triage -> 生成 comment proposal -> 用户确认 -> 写回 comment
```

范围控制：

- 只用 Linear 官方 API。
- 认证使用 personal API key。
- 不做 OAuth。
- 不做 Playwright fallback。
- 不修改 issue 字段。
- 只允许 comment 写回。
- 不做 MCP server。

## 3. 架构

```text
External Agent Host
  -> skills/linear-triage.md
  -> saas-agent CLI
      -> manifests/linear.yaml
      -> Linear API Client
      -> Local Keychain
      -> Pending Action Store
      -> Local Audit Log
          -> Linear GraphQL API
```

## 4. Capability 设计

### 4.1 MVP Capability

```text
linear.team.search
linear.issue.search
linear.issue.get
linear.comment.propose
pending.list
pending.show
pending.approve
pending.reject
```

### 4.2 命令映射

```bash
saas-agent auth login linear
saas-agent auth status linear
saas-agent auth logout linear

saas-agent capabilities list
saas-agent capabilities show linear.issue.search

saas-agent linear team search --query eng
saas-agent linear issue search --team ENG --status backlog --limit 20
saas-agent linear issue get LIN-123
saas-agent linear comment propose --issue LIN-123 --body-file comment.md

saas-agent pending list
saas-agent pending show act_123
saas-agent pending approve act_123
saas-agent pending reject act_123
```

## 5. Linear API Client

Linear connector 通过官方 GraphQL API 访问数据。

### 5.1 Auth

第一版使用 personal API key。

流程：

```text
saas-agent auth login linear
  -> prompt user for API key in TTY
  -> validate with viewer query
  -> store token in system Keychain
```

非 TTY 场景不允许交互式输入，可使用：

```bash
saas-agent auth login linear --token-stdin
```

### 5.2 Read Queries

需要支持：

- 搜索 team。
- 按 team、status、updated-before、limit 搜索 issue。
- 获取 issue 详情。

issue detail 建议包含：

- id。
- identifier。
- title。
- description。
- url。
- priority。
- state。
- assignee。
- labels。
- project。
- createdAt。
- updatedAt。
- comments 摘要。

### 5.3 Write Mutation

第一版只支持 comment 写回。

实际写入只发生在：

```bash
saas-agent pending approve act_123
```

`linear comment propose` 不调用 Linear mutation。

## 6. Pending Action 设计

### 6.1 propose comment

命令：

```bash
saas-agent linear comment propose --issue LIN-123 --body-file comment.md --output json
```

输出：

```json
{
  "requires_confirmation": true,
  "pending_action_id": "act_123",
  "capability_id": "linear.comment.propose",
  "summary": "Add a comment to LIN-123",
  "preview": {
    "issue": "LIN-123",
    "body": "Suggested triage comment..."
  },
  "expires_at": "2026-05-10T12:00:00Z"
}
```

### 6.2 approve

命令：

```bash
saas-agent pending approve act_123 --output json
```

执行步骤：

1. 读取 pending action。
2. 校验状态为 pending。
3. 校验未过期。
4. 校验 capability 风险策略。
5. 调用 Linear `commentCreate` mutation。
6. 标记 action 为 approved/executed。
7. 写入 audit log。
8. 返回 Linear comment id/url。

### 6.3 reject

reject 后 action 不可再次 approve。

## 7. Skill Markdown 设计

文件：

```text
skills/linear-triage.md
```

职责：

- 告诉 Agent 如何使用 Linear CLI。
- 定义 triage 判断规则。
- 要求写回前先生成 comment proposal。
- 要求用户确认后再 approve pending action。

建议内容结构：

```markdown
# Linear Triage Skill

## Purpose
## Available CLI Capabilities
## Triage Heuristics
## Recommended Workflow
## Comment Writing Guidelines
## Confirmation Policy
## Output Format
## Failure Handling
```

## 8. Triage Workflow

推荐流程：

```text
1. 确认用户要 triage 的 team 或项目范围。
2. 调用 team.search 找 team key/id。
3. 调用 issue.search 获取候选 issue。
4. 对高风险或不清楚的 issue 调 issue.get。
5. Agent 根据 skill 规则生成 triage summary。
6. Agent 给出建议 comment。
7. 调用 linear.comment.propose 创建 pending action。
8. 用户确认后调用 pending.approve。
```

## 9. 输出规范

Agent-facing JSON 必须稳定。

issue search 输出示例：

```json
{
  "issues": [
    {
      "id": "uuid",
      "identifier": "LIN-123",
      "title": "Fix billing sync",
      "state": "In Progress",
      "priority": "High",
      "assignee": "Ada",
      "updated_at": "2026-05-01T08:00:00Z",
      "url": "https://linear.app/acme/issue/LIN-123"
    }
  ],
  "page_info": {
    "has_next_page": false,
    "end_cursor": null
  }
}
```

错误输出示例：

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Linear token is missing. Run `saas-agent auth login linear`.",
    "retryable": false
  }
}
```

## 10. 安全边界

- `issue.search` 和 `issue.get` 是 read，可直接执行。
- `comment.propose` 是 write proposal，不直接写入。
- `pending.approve` 是唯一真实写入入口。
- 不允许 Agent 直接调用 Linear mutation。
- 不支持修改 priority、state、assignee、label。
- 不支持删除 comment。

## 11. 后续扩展

### 11.1 issue update

在 comment 写回稳定后，可加入：

```text
linear.issue.update.propose
```

支持字段：

- assignee。
- priority。
- label。
- state。

仍需 pending action。

### 11.2 MCP adapter

从 `linear.yaml` 生成：

```text
linear_team_search
linear_issue_search
linear_issue_get
linear_comment_propose
pending_approve
```

### 11.3 Browser fallback

Linear 第一版不需要。未来用第二个 reference SaaS 验证 API 不完整场景。

