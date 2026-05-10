# 通用 PRD：端侧 SaaS Semantic CLI for Agents

## 1. 产品概述

端侧 SaaS Semantic CLI 是一个纯本地工具层，把传统 SaaS 的业务对象和操作流程封装成 Agent 可调用的本地语义命令。用户无需等待 SaaS 厂商改造产品，也无需把业务数据经过第三方云端，即可让本机 Agent 调用 SaaS 能力完成业务工作流。

第一版产品聚焦 CLI，不做自研 Agent、不做 MCP server、不做云端 control plane。

## 2. 用户与场景

### 2.1 目标用户

- 使用端侧 Agent 的开发者、产品经理、运营人员或团队负责人。
- 希望在本地 AI 工作流里操作 SaaS 的高级用户。
- 希望验证 AI-native SaaS workflow 的团队。

### 2.2 核心场景

用户在端侧 Agent 中提出业务任务：

```text
帮我整理最近卡住的任务，生成处理建议，并在确认后写回 SaaS。
```

Agent 根据 skill markdown 调用本地 CLI：

```text
读取 SaaS 数据 -> 分析 -> 生成建议 -> propose 写操作 -> 用户确认 -> approve 执行
```

## 3. 产品定位

### 3.1 是什么

- 一个本地 SaaS semantic adapter。
- 一个 Agent-friendly CLI。
- 一套 capability manifest + skill markdown 的连接器规范。
- 一个带两阶段确认的本地写操作执行层。

### 3.2 不是什么

- 不是新的 Agent 客户端。
- 不是通用 RPA 平台。
- 不是云端 SaaS 聚合服务。
- 不是直接暴露 API endpoint 或浏览器 DOM 的低层工具。

## 4. MVP 范围

### 4.1 必须支持

- 安装并运行 `saas-agent` CLI。
- 提供 capability manifest。
- 提供至少一个 reference connector。
- 支持通用 skill markdown。
- 支持认证信息本地保存。
- 支持结构化 JSON 输出。
- 支持 read capability 直接执行。
- 支持 write capability 两阶段确认。
- 支持 pending action list/show/approve/reject。

### 4.2 暂不支持

- MCP server。
- 常驻 daemon。
- 本地 Web UI。
- 云端 catalog。
- 用户自定义 connector。
- 多用户权限管理。
- 浏览器自动化作为 MVP 主路径。

## 5. 功能需求

### 5.1 CLI 基础能力

命令：

```bash
saas-agent --help
saas-agent version
saas-agent capabilities list
saas-agent capabilities show <capability-id>
```

要求：

- TTY 下默认人类可读输出。
- 非 TTY 下默认 JSON。
- 所有命令支持 `--output json`。
- stdout 只输出数据。
- stderr 输出日志、进度、警告。
- 非 TTY 下不允许阻塞式交互。

### 5.2 Connector Auth

命令：

```bash
saas-agent auth login <provider>
saas-agent auth status <provider>
saas-agent auth logout <provider>
```

验收标准：

- token 存系统 Keychain 或等价本地安全存储。
- logout 后 CLI 不再能读取该 provider 数据。
- status 不泄露 token 原文。

### 5.3 Capability Discovery

命令：

```bash
saas-agent capabilities list --output json
saas-agent capabilities show <id> --output json
```

验收标准：

- 返回 capability id、描述、风险等级、输入 schema、输出 schema、CLI 映射。
- Agent 可以用返回结果构造后续命令。

### 5.4 Read Capability

读能力可以直接执行。

验收标准：

- 成功时返回结构化数据。
- 失败时返回结构化错误。
- 支持 limit/cursor。
- 不产生 pending action。

### 5.5 Write Proposal

写能力不直接执行，只生成 pending action。

命令形式：

```bash
saas-agent <provider> <resource> <action> propose ...
```

验收标准：

- 返回 `pending_action_id`。
- 返回用户可理解的操作摘要。
- 不调用 SaaS 写接口。
- pending action 有过期时间。

### 5.6 Pending Action

命令：

```bash
saas-agent pending list
saas-agent pending show <id>
saas-agent pending approve <id>
saas-agent pending reject <id>
```

验收标准：

- approve 后才真正调用 SaaS 写接口。
- reject 后 action 不可执行。
- 已执行 action 不可重复执行。
- 过期 action 不可执行。
- approve 输出执行结果。

### 5.7 Skill Markdown

每个 workflow 至少提供一份通用 skill markdown。

内容必须包括：

- 适用场景。
- 可用 capability。
- 推荐调用顺序。
- 业务判断规则。
- 写操作确认规则。
- 输出格式。
- 常见错误处理。

验收标准：

- Agent 可根据 skill 完成目标 workflow。
- 用户可通过本地 override 扩展业务规则。
- override 不能改变 runtime 安全策略。

## 6. 非功能需求

### 6.1 安全

- 默认纯本地运行。
- token 和业务数据不经过平台云端。
- 写操作必须两阶段确认。
- 不允许 skill 或用户配置降低内置 capability 风险等级。

### 6.2 可观测性

- 本地 audit log 记录关键调用。
- 错误信息可读、可机器解析。
- 提供诊断命令的扩展空间。

### 6.3 稳定性

- CLI exit code 必须明确。
- 网络错误、认证错误、权限错误、参数错误需要区分。
- 搜索结果默认有上限。

### 6.4 可扩展性

- manifest 和 connector implementation 分离。
- CLI 命令从 manifest 映射。
- 后续可从 manifest 生成 MCP tools。

## 7. 成功指标

MVP 成功标准：

- 一个外部 Agent 可以只通过 skill + CLI 完成 reference workflow。
- 用户确认前不会产生任何 SaaS 写操作。
- CLI 的 JSON 输出可被 Agent 稳定解析。
- reference connector 不依赖 SaaS 厂商改造。
- 用户 token 和业务数据不经过平台云端。

## 8. 关键风险

- Agent 可能错误理解 CLI 输出。
- 业务 skill 过薄会导致 Agent 调用不稳定。
- 写操作确认体验可能偏重。
- 不做 MCP 会限制部分 Agent Host 的即插即用体验。
- 多 SaaS 扩展时 manifest 抽象可能需要调整。

## 9. 里程碑

### Milestone 1：CLI 基础框架

- CLI skeleton。
- output mode。
- capabilities list/show。
- 本地配置目录。

### Milestone 2：Reference Connector

- auth login/status/logout。
- read capabilities。
- structured errors。

### Milestone 3：Pending Action

- propose。
- pending store。
- approve/reject。
- audit log。

### Milestone 4：Agent Workflow

- skill markdown。
- 端到端 demo。
- 文档和示例命令。

