# Linear Reference Connector PRD

## 1. 产品概述

Linear Reference Connector 是端侧 SaaS Semantic CLI 的第一个 reference connector。它通过本地 CLI 暴露 Linear 的 issue 读取和 comment 写回能力，让外部端侧 Agent 可以完成 Linear issue triage workflow。

第一版只做一个高质量闭环：

```text
查找 Linear issue -> Agent triage -> propose comment -> 用户确认 -> 写回 comment
```

## 2. 用户故事

### 2.1 Triage 团队 issue

作为团队负责人，我希望在 Agent 中说：

```text
帮我整理 Linear 里 Platform team 最近卡住的 issue，并给出处理建议。
```

Agent 能够：

- 调用 CLI 搜索 team。
- 调用 CLI 搜索 issue。
- 读取关键 issue 详情。
- 生成 triage summary。
- 为需要跟进的 issue 草拟 comment。
- 在我确认后把 comment 写回 Linear。

### 2.2 安全写回

作为用户，我希望 Agent 不能未经确认修改 Linear。任何 comment 写回都必须先展示预览，并在我确认后才执行。

## 3. MVP 范围

### 3.1 In Scope

- Linear personal API key 登录。
- 本地 token 安全存储。
- team search。
- issue search。
- issue get。
- comment propose。
- pending list/show/approve/reject。
- Linear triage skill markdown。
- JSON/human 双输出模式。
- 本地 audit log。

### 3.2 Out of Scope

- OAuth。
- MCP server。
- Playwright/browser automation。
- issue 字段修改。
- comment 删除或编辑。
- 用户自定义 connector。
- 云端同步或 catalog。
- 本地 Web UI。

## 4. 功能需求

### 4.1 Auth

命令：

```bash
saas-agent auth login linear
saas-agent auth login linear --token-stdin
saas-agent auth status linear
saas-agent auth logout linear
```

验收标准：

- login 成功后可以调用 Linear read 命令。
- login 会验证 token 有效性。
- token 不出现在 stdout、stderr、配置文件或 audit log 中。
- status 显示是否已登录和当前 Linear viewer 摘要。
- logout 后 read 命令返回 `AUTH_REQUIRED`。

### 4.2 Capability Discovery

命令：

```bash
saas-agent capabilities list --output json
saas-agent capabilities show linear.issue.search --output json
```

验收标准：

- 返回所有 Linear MVP capabilities。
- 每个 capability 有 id、description、risk、input_schema、output_schema、cli。

### 4.3 Team Search

命令：

```bash
saas-agent linear team search --query platform --limit 10 --output json
```

输入：

- `--query` 可选。
- `--limit` 默认 20。

输出：

```json
{
  "teams": [
    {
      "id": "uuid",
      "key": "PLAT",
      "name": "Platform"
    }
  ]
}
```

验收标准：

- 支持按名称或 key 搜索。
- 未登录时返回 `AUTH_REQUIRED`。

### 4.4 Issue Search

命令：

```bash
saas-agent linear issue search --team PLAT --status "In Progress" --limit 20 --output json
```

MVP 参数：

- `--team`
- `--status`
- `--assignee`
- `--updated-before`
- `--updated-after`
- `--label`
- `--limit`
- `--cursor`

输出：

```json
{
  "issues": [
    {
      "id": "uuid",
      "identifier": "PLAT-123",
      "title": "Fix sync retry",
      "state": "In Progress",
      "priority": "High",
      "assignee": "Ada",
      "labels": ["backend"],
      "updated_at": "2026-05-01T08:00:00Z",
      "url": "https://linear.app/acme/issue/PLAT-123"
    }
  ],
  "page_info": {
    "has_next_page": false,
    "end_cursor": null
  }
}
```

验收标准：

- 默认 limit 不超过 20。
- 支持分页。
- 输出字段稳定。

### 4.5 Issue Get

命令：

```bash
saas-agent linear issue get PLAT-123 --output json
```

输出包含：

- issue 基础字段。
- description。
- comments 摘要。
- labels。
- project。
- parent/related issue 基础信息，如 API 可用。

验收标准：

- 可用 identifier 或 id 查询。
- issue 不存在返回 `NOT_FOUND`。

### 4.6 Comment Propose

命令：

```bash
saas-agent linear comment propose --issue PLAT-123 --body-file comment.md --output json
```

输出：

```json
{
  "requires_confirmation": true,
  "pending_action_id": "act_123",
  "summary": "Add a comment to PLAT-123",
  "preview": {
    "issue": "PLAT-123",
    "body": "Triage summary..."
  },
  "expires_at": "2026-05-10T12:00:00Z"
}
```

验收标准：

- 不调用 Linear 写接口。
- body 可以来自 `--body` 或 `--body-file`。
- body 为空时报参数错误。
- pending action 包含必要执行参数。

### 4.7 Pending Actions

命令：

```bash
saas-agent pending list --output json
saas-agent pending show act_123 --output json
saas-agent pending approve act_123 --output json
saas-agent pending reject act_123 --output json
```

验收标准：

- list 显示 pending 状态 action。
- show 显示摘要和 preview。
- approve 执行 Linear comment create。
- approve 成功后返回 comment id/url。
- approve 不可重复执行。
- reject 后不可 approve。

## 5. Linear Triage Skill

文件：

```text
skills/linear-triage.md
```

必须包含：

- 使用场景。
- CLI 能力清单。
- 推荐 triage 流程。
- stale / blocked / unowned issue 判断规则。
- comment 写作规范。
- 确认流程。
- 输出格式。

建议 triage 规则：

- 高优先级但无人负责，需要标记。
- 长时间未更新，需要建议 next step。
- 有 blocked label 或描述中出现 blocker，需要重点列出。
- issue 描述不清，需要建议补充信息。
- 不允许在未明确请求时建议关闭 issue。

## 6. Agent 端推荐输出

Agent 完成 triage 后应输出：

```text
Summary:
- 本次检查范围
- 发现的主要风险

Issues:
- PLAT-123: 状态、风险、建议
- PLAT-456: 状态、风险、建议

Proposed Comments:
- PLAT-123: comment preview

Confirmation:
- 询问用户是否写回 comment
```

用户确认后，Agent 调用：

```bash
saas-agent pending approve act_123 --output json
```

## 7. 错误处理

错误输出统一：

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Linear token is missing. Run `saas-agent auth login linear`.",
    "retryable": false
  }
}
```

错误码：

```text
AUTH_REQUIRED
AUTH_INVALID
PERMISSION_DENIED
NOT_FOUND
VALIDATION_ERROR
RATE_LIMITED
NETWORK_ERROR
LINEAR_API_ERROR
PENDING_ACTION_NOT_FOUND
PENDING_ACTION_EXPIRED
PENDING_ACTION_ALREADY_EXECUTED
```

## 8. 成功指标

MVP 验收：

- 用户可以完成 Linear 登录。
- Agent 可以通过 CLI 查 team、查 issue、读 issue。
- Agent 可以根据 skill 生成 triage summary。
- comment propose 不产生实际写入。
- pending approve 成功写回 Linear comment。
- 所有 Agent-facing 输出可 JSON 解析。
- 非 TTY 下无阻塞交互。

## 9. 里程碑

### M1：CLI 与 Manifest

- CLI skeleton。
- output mode。
- linear manifest。
- capabilities list/show。

### M2：Linear Read

- auth login/status/logout。
- team search。
- issue search。
- issue get。

### M3：Comment Write Flow

- comment propose。
- pending store。
- approve/reject。
- audit log。

### M4：Agent Demo

- linear triage skill markdown。
- 端到端 demo script。
- README 示例。

