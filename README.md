# SaaS AI Native Agent

本仓库用于设计和沉淀一种端侧 SaaS Agent 化方案：通过本地 semantic CLI，把传统 SaaS 的业务对象和操作流程包装成 Agent 可稳定调用、可审计、可确认的能力层。

第一阶段目标不是做新的 Agent 客户端，也不是做云端聚合服务，而是验证：

```text
外部端侧 Agent -> Skill Markdown -> 本地 saas-agent CLI -> SaaS 官方 API
```

## 核心想法

传统 SaaS 已经有成熟的业务对象、权限体系和流程，但 Agent 往往只能面对 Web UI、零散 API wrapper 或脚本。这个项目希望在用户本机提供一个语义适配层，让 Agent 看到的是稳定的业务能力，而不是低层接口细节。

设计原则：

- 纯本地运行，token 和业务数据不经过平台云端。
- CLI first，第一版不做 MCP server、daemon 或 Web UI。
- Agent-friendly 输出，所有面向 Agent 的命令支持结构化 JSON。
- 读操作可直接执行，写操作必须先 propose，再由用户 approve。
- capability manifest 作为能力发现、CLI 映射和未来工具生成的单一来源。
- skill markdown 承载 workflow、业务判断规则和安全调用策略。

## MVP 范围

MVP 聚焦一个完整闭环：

```text
读取 SaaS 数据 -> Agent 分析 -> 生成写操作 proposal -> 用户确认 -> 写回 SaaS
```

必须支持：

- `saas-agent` CLI 基础框架。
- capability list/show。
- 本地认证信息保存。
- JSON/human 双输出模式。
- read capability 直接执行。
- write capability 两阶段确认。
- pending action 的 list/show/approve/reject。
- 本地 audit log。
- 至少一个 reference connector。

暂不支持：

- MCP server。
- 常驻 daemon。
- 云端 control plane。
- 本地 Web UI。
- 用户自定义 connector。
- 浏览器自动化作为主路径。

## Reference Connector: Linear

第一版 reference connector 选择 Linear，用来验证真实研发协作场景中的 triage workflow。

目标闭环：

```text
查找 Linear issue -> Agent triage -> propose comment -> 用户确认 -> 写回 comment
```

Linear MVP capabilities：

- `linear.team.search`
- `linear.issue.search`
- `linear.issue.get`
- `linear.comment.propose`
- `pending.list`
- `pending.show`
- `pending.approve`
- `pending.reject`

示例命令形态：

```bash
saas-agent auth login linear
saas-agent linear team search --query platform --output json
saas-agent linear issue search --team PLAT --status "In Progress" --limit 20 --output json
saas-agent linear issue get PLAT-123 --output json
saas-agent linear comment propose --issue PLAT-123 --body-file comment.md --output json
saas-agent pending approve act_123 --output json
```

## End-to-End Linear Triage Demo

This demo is intentionally shell-only. A shell-capable Agent can follow it without MCP, a daemon, browser automation, or any cloud control plane.

Authenticate with a Linear personal API key:

```bash
printf '%s' "$LINEAR_API_KEY" | saas-agent auth login linear --token-stdin --output json
saas-agent auth status linear --output json
```

Discover the team and search a bounded set of issues:

```bash
saas-agent linear team search --query platform --limit 20 --output json
saas-agent linear issue search --team PLAT --status "Todo" --limit 20 --output json
```

Inspect an issue before writing any recommendation:

```bash
saas-agent linear issue get PLAT-123 --output json
```

Draft a comment locally and create a pending action. This does not write to Linear:

```bash
cat > /tmp/linear-comment.md <<'EOF'
This looks blocked on ownership: the issue is high priority, currently unassigned, and has not been updated recently. Can someone confirm the owner or move it back to triage?
EOF

saas-agent linear comment propose --issue PLAT-123 --body-file /tmp/linear-comment.md --output json
saas-agent pending show act_123 --output json
```

After the user confirms the preview, approve the pending action to write the comment:

```bash
saas-agent pending approve act_123 --output json
```

If the user declines, reject it instead:

```bash
saas-agent pending reject act_123 --output json
```

The companion skill file is [skills/linear-triage.md](skills/linear-triage.md). User skill overrides may tune triage rules and comment style, but they cannot bypass pending action safety: read commands may run directly, while comment writeback must go through `linear comment propose` and `pending approve`.

## 文档导航

- [通用 PRD](docs/generic-prd.md)：产品定位、MVP 范围、功能需求和成功指标。
- [通用架构设计](docs/generic-architecture.md)：整体架构、核心模块、manifest、skill、pending action 和 audit log。
- [Linear PRD](docs/linear-prd.md)：Linear reference connector 的产品需求。
- [Linear 架构设计](docs/linear-architecture.md)：Linear connector 的架构、capability 和 pending action 设计。
- [Agent-friendly CLI Guide](docs/agent-friendly-cli-guide.md)：面向 Agent 的 CLI 设计规范。
- [Agent 工作说明](AGENTS.md)：本仓库的 Agent 协作、issue tracker、triage labels 和文档约定。

## CLI 设计约束

设计或实现 CLI 时，请遵循 [Agent-friendly CLI Guide](docs/agent-friendly-cli-guide.md)。关键约束包括：

- stdout 只输出数据。
- stderr 输出日志、进度、警告。
- 非 TTY 环境不做阻塞式交互。
- Agent-facing 命令必须支持 `--output json`。
- 搜索类命令必须支持 `--limit`，需要分页时支持 `--cursor`。
- 错误输出需要可读、可机器解析，并使用明确 exit code。
- destructive 或 write 操作必须有显式安全边界。

## 当前状态

当前仓库处于产品和架构设计阶段，已公开仓库并补充核心设计文档。下一步可以进入实现阶段：

1. 搭建 `saas-agent` CLI skeleton。
2. 定义 capability manifest schema。
3. 实现 Linear auth 与 read capabilities。
4. 实现 pending action store 和两阶段 comment 写回。
5. 编写 `skills/linear-triage.md` 并完成端到端 demo。

## 许可证

当前尚未添加许可证文件。公开使用或复用前，请先补充明确的 license。
