# 通用架构设计方案：端侧 SaaS Semantic CLI for Agents

## 1. 背景

传统 SaaS 已经沉淀了大量业务对象、权限体系和操作流程，但这些能力通常通过 Web UI、后台 API 或人工流程暴露给用户。端侧 Agent 要使用这些 SaaS 能力时，常见做法是直接调用浏览器、shell 脚本或零散 API wrapper。这种方式可以快速验证，但长期会遇到几个问题：

- Agent 看到的是低层 API、DOM 或命令，而不是业务语义能力。
- 输出格式偏人类阅读，Agent 难以稳定解析。
- 写操作缺少统一确认和审计边界。
- 不同 SaaS 的接入方式不一致，难以沉淀成可复用连接器。

本方案目标是在用户本机提供一个纯端侧的 SaaS semantic adapter，把传统 SaaS 能力封装成 Agent 可调用的本地语义 CLI，并通过通用 skill markdown 承载业务流程和判断规则，实现 SaaS 无改造成本接入端侧 Agent。

## 2. 目标

### 2.1 产品目标

- 用户在本机安装一个 CLI 工具后，外部端侧 Agent 可以调用传统 SaaS 的业务能力。
- SaaS 厂商无需改造现有产品。
- 第一阶段只做 CLI，不做常驻 daemon 和 MCP server。
- CLI 面向 Agent 友好：结构化、非交互、可发现、可审计。
- 写操作采用两阶段确认，避免 Agent 误写业务系统。

### 2.2 非目标

- 第一版不做自研 Agent 客户端。
- 第一版不做 MCP server。
- 第一版不做云端 control plane。
- 第一版不支持用户自定义 connector。
- 第一版不把浏览器自动化作为默认路径。

## 3. 核心架构

```text
External Agent Host
  -> Generic Skill Markdown
  -> saas-agent CLI
      -> Capability Manifest
      -> Connector Implementation
          -> SaaS Official API
          -> Optional Browser Automation
      -> Local Auth Store
      -> Pending Action Store
      -> Local Audit Log
```

## 4. 核心模块

### 4.1 Agent Host

Agent Host 是用户已有的端侧 Agent 环境，例如 Codex、Claude Desktop、Cursor、Cline、Continue 或其他 shell-capable Agent。它负责：

- 理解用户意图。
- 读取 skill markdown。
- 决定调用哪些 CLI capability。
- 生成业务判断和自然语言总结。
- 在用户确认后调用 pending approval 命令。

本系统不替代 Agent Host，只提供本地 SaaS 能力层。

### 4.2 Semantic CLI

CLI 是第一版唯一正式入口，命令风格为：

```text
saas-agent <provider> <resource> <action>
```

示例：

```bash
saas-agent linear issue search --team ENG --limit 20
saas-agent linear issue get LIN-123
saas-agent linear comment propose --issue LIN-123 --body-file comment.md
saas-agent pending approve act_123
```

CLI 设计原则：

- TTY 默认输出 human text/table。
- 非 TTY 默认输出 JSON。
- 所有 Agent-facing 命令必须支持 `--output json`。
- stdout 只输出数据。
- stderr 输出日志、进度、警告。
- 非 TTY 永不阻塞，不出现交互式 prompt。
- 搜索类命令必须支持 `--limit`、`--cursor`、必要时支持 `--fields`。

### 4.3 Capability Manifest

Capability manifest 是系统的一等对象，描述每个可调用能力的业务语义、参数、输出和风险级别。

示例：

```yaml
id: linear.issue.search
provider: linear
resource: issue
action: search
risk: read
input_schema:
  type: object
  properties:
    team:
      type: string
    status:
      type: string
    limit:
      type: integer
      default: 20
output_schema:
  type: object
  properties:
    issues:
      type: array
implementation: linear.searchIssues
cli:
  command: linear issue search
```

manifest 的职责：

- 作为 CLI help、能力发现和文档生成的单一来源。
- 标记风险级别：`read`、`write_propose`、`admin` 等。
- 描述输入输出 schema，帮助 Agent 稳定调用。
- 为后续 MCP server 生成工具定义保留可能性。

第一版内置 connector manifest 不允许用户修改。

### 4.4 Connector Implementation

Connector implementation 负责把 semantic capability 映射到 SaaS 实际执行面。

优先级：

1. 官方 API。
2. 官方 SDK。
3. 浏览器自动化 fallback。

第一版以官方 API 为主。浏览器自动化是框架未来能力，但不作为 MVP 核心路径。

### 4.5 Generic Skill Markdown

只暴露 CLI 命令不够，Agent 还需要知道什么时候调用、如何判断、如何组织输出、如何处理写操作。因此每个 connector 或 workflow 配套一份通用 skill markdown。

skill markdown 负责：

- 描述业务场景和适用范围。
- 说明可用 capability。
- 定义业务判断规则。
- 约束读写策略。
- 规定输出格式。
- 规定失败恢复方式。

用户允许本地覆盖或扩展 skill 规则，但不能覆盖 runtime 安全策略。

建议路径：

```text
skills/<provider>-<workflow>.md
~/.saas-agent/skills/<provider>-<workflow>.local.md
```

合并策略：

- 内置 skill 作为 base。
- 用户 local skill 作为补充或局部覆盖。
- 写操作安全策略始终由 CLI runtime 和 manifest 风险级别决定。

### 4.6 Auth Store

认证信息只存本地。第一阶段推荐使用 SaaS personal API key 或 device-code friendly auth。

要求：

- token 不写入明文配置。
- 优先使用系统 Keychain / Credential Manager。
- 提供 login、status、logout 命令。
- 不经过平台云端服务。

示例：

```bash
saas-agent auth login linear
saas-agent auth status linear
saas-agent auth logout linear
```

### 4.7 Pending Action Store

所有写操作必须两阶段执行：

```text
propose -> pending_action_id -> approve -> execute
```

写操作命令不直接修改 SaaS，而是生成 pending action：

```bash
saas-agent linear comment propose --issue LIN-123 --body-file comment.md --output json
```

返回：

```json
{
  "requires_confirmation": true,
  "pending_action_id": "act_123",
  "summary": "Add a comment to LIN-123",
  "expires_at": "2026-05-10T12:00:00Z"
}
```

用户确认后执行：

```bash
saas-agent pending approve act_123 --output json
```

pending action 应保存：

- action id。
- connector id。
- capability id。
- 操作摘要。
- 操作参数 hash。
- 创建时间和过期时间。
- 执行状态。
- 执行结果。

### 4.8 Audit Log

本地记录 Agent 对 SaaS 的关键操作，尤其是写操作。

记录内容：

- 时间。
- provider。
- capability id。
- 调用参数摘要。
- pending action id。
- approve/reject 状态。
- SaaS 返回结果摘要。
- 错误信息。

第一版只做本地日志，不上传云端。

## 5. CLI 能力发现

CLI 必须支持能力自描述：

```bash
saas-agent capabilities list --output json
saas-agent capabilities show linear.issue.search --output json
```

用于：

- Agent 探索当前可用能力。
- 用户调试。
- 后续生成 MCP tools。
- 生成文档。

## 6. 风险模型

### 6.1 风险等级

```text
read:
  可直接执行，只读取 SaaS 数据。

write_propose:
  只能生成 pending action，不能直接写入。

admin:
  第一版不开放，后续需要更强确认和安全策略。
```

### 6.2 安全原则

- Agent 不能绕过 pending action。
- skill 不能修改 capability 风险等级。
- 非 TTY 下不允许交互式确认。
- 所有写操作必须有明确摘要。
- approve 时需要校验 pending action 未过期、未执行、参数 hash 一致。

## 7. 目录建议

```text
saas-agent/
  manifests/
    linear.yaml
  skills/
    linear-triage.md
  connectors/
    linear/
      api-client.ts
      capabilities.ts
  src/
    cli/
    auth/
    pending/
    audit/
    manifest/
  docs/
```

## 8. 后续演进

### Phase 1：Semantic CLI MVP

- 单 connector。
- 官方 API。
- agent-friendly CLI。
- capability manifest。
- skill markdown。
- pending action。

### Phase 2：更多 connector 与 browser fallback

- 引入第二个 API 不完整的 SaaS。
- 验证 Playwright adapter。
- 增强错误恢复和状态检测。

### Phase 3：MCP adapter

- 从 manifest 生成 MCP tools。
- 保持 CLI 和 MCP 同源。
- 支持更多外部 Agent Host。

### Phase 4：可选本地 UI

- 本地 pending action approval UI。
- 本地 connector 状态页。
- 本地 audit viewer。

