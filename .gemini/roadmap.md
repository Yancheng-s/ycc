# Harness Agent 开发节奏与演进计划

## 一、 核心开发哲学与演进节奏

1. **加尔定律（Gall's Law）**：所有能正常运行的复杂系统，必然是从一个能够运行的简单系统演变而来的。杜绝过早设计复杂的空桩与目录。
2. **自然生长法则**：
   - 极简单文件 MVP 跑通最小闭环；
   - 单文件长出骨肉与核心能力；
   - 代码量上来后，按职责扁平拆分（每个模块独立单文件）；
   - 引入 Hook 管道机制解耦生命周期；
   - 业务复杂度提升后，各模块独立成高内聚文件夹并统一注册进管道。
3. **测试为安全绳**：功能模块变动必同步写/改测试，变动后必须执行全量回归测试（`npm test`），保证行为不退化。
4. **编码规范严格遵守**：
   - 不生成冗余解释性注释，代码自解释；
   - 禁止使用 `??` 空值合并运算符做隐式兜底，异常与缺失必须显式前置校验；
   - 修改代码保持简洁彻底，坚决不做过度谨慎的“向下兼容旧代码”，绝不保留多余的垫片（Shim）、历史别名与过渡重导出层。

---

## 二、 里程碑进度

### ✅ 已完成环节

- [x] **阶段 1：极简单文件 MVP**
  - 彻底清理过度设计的空桩目录，将代码收敛为极简内核。
  - 完成最纯粹的单轮 LLM 问答闭环。
- [x] **阶段 2：环境配置标准化**
  - 去除代码内硬编码的兜底域名，完全由环境变量驱动。
  - 对齐业界标准的 `OPENAI_*` 规范，成功直连讯飞星火 Spark 大模型。
- [x] **阶段 3：多轮对话记忆（Conversation Memory）**
  - 引入 `history` 消息队列，每次请求携带完整上下文。
  - 实现跨轮次的状态累积与记忆连贯。
- [x] **阶段 4：架构扁平拆分（CLI 模块化）**
  - 将终端交互与 REPL 循环抽离至 `src/cli.ts`。
  - `src/main.ts` 纯粹聚焦于核心 `chat` 函数与大模型通信，实现视图与内核解耦。
- [x] **阶段 5：Agent 工具调用闭环（Tool Calling Loop）**
  - 定义高内聚的 `Tool` 契约（声明参数 Schema 与本地 `execute` 函数）。
  - 在 `src/main.ts` 中实现受控执行循环：支持 `tool_calls` 调度、结果构造成 `{ role: "tool" }` 回填上下文，以及 `maxTurns` 轮数保护。
- [x] **阶段 6：内置核心工具集与终端装载（Built-in Tools & CLI Mounting）**
  - 新建独立单文件 `src/tools.ts`，交付 `get_current_time` 与 `run_command`（PowerShell 执行器）。
  - 内置 10 秒超时熔断与 2000 字符截断保护，杜绝死锁与 Token 膨胀。
  - 在 `src/cli.ts` 中完成默认挂载，让终端 Agent 真正具备动手执行能力。
- [x] **阶段 7：内核扁平拆分（Flat Modularization）**
  - 将原单体 `src/main.ts` 依职责扁平拆解为：`src/types.ts`（类型契约）、`src/client.ts`（大模型客户端）、`src/agent.ts`（受控循环引擎）及 `src/main.ts`（极简启动入口）。
  - 彻底剥离启动入口对核心调度的入侵，消除脆弱的 `isEntry` 判断。
  - 全量 15 个契约测试保持 100% 变绿通过，零行为退化。
- [x] **阶段 8：生命周期 Hook 管道与分发器（Lifecycle Hooks & HookDispatcher）**
  - 在 `src/types.ts` 定义 `AgentHooks` 生命周期契约，并支持单个或数组传参（`hooks?: AgentHooks | AgentHooks[]`）。
  - 引入工业级空对象与分发器模式（`src/dispatcher.ts`: `HookDispatcher`），将判空、遍历与多重广播封装为黑盒。
  - 重构 `src/agent.ts`：内核对 Hook 的触发彻底消除全部 `if` 判断，实现 0 分支盲调（`dispatcher.onLLMRequest(...)` 等）。
  - 新建 `src/logger.ts` 提供开箱即用的终端格式化监听器 `consoleLogger`。
  - 全量 23 个测试用例保持 100% 变绿通过（含 `dispatcher.test.ts` 的广播验证），零回归退化。
- [x] **阶段 9：流式传输与数据碎片组装（Streaming & Chunk Assembly）**
  - 在 `src/types.ts` 扩充流式钩子 `onStreamChunk?: (chunk: OpenAI.Chat.ChatCompletionChunk) => void`，分发器支持向多端即时广播无损原始数据片。
  - 内核 `src/agent.ts` 升级为 `stream: true` 异步数据流迭代（`for await of stream`），实现文本累加与工具 JSON 碎片后台静默组装双轨制。
  - 终端 `consoleLogger` 接入原始数据片 JSON 打印。
  - 全面更新单元测试至 25 个（包含流式逐字符消费与工具参数拆分拼装验证，100% 通过）。
  - 严格践行文档资产全生命周期治理：新增 `docs/06-streaming-chunk-assembly.md`，更新系统全景图与索引。
- [x] **阶段 10：插件物理隔离与人机交互安全守卫（Plugins Directory & Human-in-the-Loop）**
  - 正式建立 `src/hooks/` 插件物理隔离目录，将外围扩展与核心引擎物理解耦；
  - 迁入 `src/hooks/logger.ts`，新建 `src/hooks/guard.ts`，通过 `src/hooks/index.ts` 统一暴露出口；
  - 在 `AgentHooks` 中实现 Level 3 守卫型契约 `beforeToolExecute`，在分发器中支持一票否决式短路拦截；
  - 内核联动：被拦截操作安全回填 `{ role: "tool", content: "Error: User or security guard rejected..." }`，实现模型自愈决策；
  - 在 `src/cli.ts` 终端装载人机确认弹窗，针对 `run_command` 实施 `(y/n)` 授权放行；
  - 全量 5 个测试文件、30 个契约用例 100% 变绿通过；
  - 践行文档全生命周期治理：新增 `docs/07-human-in-the-loop-guard.md`，更新系统全景图与索引。
- [x] **阶段 11：Workspace 容器、沙箱隔离与原生文件工具（Workspace, Sandbox & File System Tools）**
  - [x] 架构设计与 RFC 规范落地：产出 `docs/08-workspace-sandbox-context.md`，刷新系统全景拓扑图；
  - [x] 在 `src/types.ts` 中确立 `Workspace` 核心契约与环境上下文；
  - [x] 实现沙箱路径解析与越界拦截守卫 `src/sandbox.ts`（`resolveInWorkspace`）；
  - [x] 将 `src/tools.ts` 升级拆解为 `src/tools/` 模块化目录（`time.ts`, `shell.ts`, `fs.ts`, `index.ts`）；
  - [x] 交付三大安全原生文件工具：`read_file`、`write_file`、`list_directory`（受限沙箱保护与自愈引导）；
  - [x] 实现 `createWorkspace` 工厂与环境上下文 System Prompt 装配（OS、根路径、安全与黑板机制）；
  - [x] 内核 `src/agent.ts` 支持 Workspace 容器注入与首条 System 消息自动编译；
  - [x] 终端 `src/cli.ts` 进入 Workspace 房间运行模式；
  - [x] 完成架构纯粹主义重构：淘汰 ChatOptions，maxTurns、tools、hooks 100% 收敛至 Workspace；
  - [x] 契约命名对齐：将 AgentHooks 全局统一重命名为 WorkspaceHooks，彻底消除主谓倒置遗留；
  - [x] 智能根目录探测：实现 `findProjectRoot` 向上回溯算法与用户家目录天花板保护，避免深层子目录执行时上下文受限；
  - [x] 8 个测试套件、62 个契约用例 100% 变绿通过（含 1 个跳过的 live API 用例）。
- [x] **阶段 12：非侵入式项目全局持久化与工作区映射（Global Non-Intrusive Storage in `~/.ycc/`）**
  - [x] 确定零污染架构设计哲学（方案 B），代码库内绝不写入点号配置文件；
  - [x] 建立 `src/storage.ts` 存储子系统，确立 `~/.ycc/` 全局存储根目录，生产代码 100% 消除 `process.env`；
  - [x] 实现项目路径指纹算法 `getProjectFingerprint`（大小写不敏感 SHA-256 + 人类可读 slug 抽屉名）；
  - [x] 确立项目物理抽屉结构（`meta.json`、`sessions/`、`scratch/`），实现原子化更新 `ensureWorkspaceStorage`；
  - [x] 扩展 `Workspace` 契约，自动挂载与注入 `storageDir` 属性；
  - [x] 实现会话持久化与恢复 API（`saveSession`, `loadSession`, `listSessions`），在 CLI 中集成无感自动归档；
  - [x] 新增 `tests/storage.test.ts` 单元测试套件，9 个测试文件、71 个用例 100% 变绿通过；
  - [x] 全局命令分发与打包：配置 `package.json` 的 `bin: { ycc: "./dist/main.js" }`，支持全局 `npm link` 与生产打包编译（`tsconfig.build.json`）；
  - [x] 交互式配置向导：实现 `ycc init` 交互式覆盖配置与 `ycc up` / `ycc run` 自动预检、缺失时内联向导并无缝直接启动；
  - [x] 彻底摒弃 `process.env` 与 `.env`：彻底删除工程本地环境文件，移除代码中所有读取或判断 `process.env.OPENAI_*` 的逻辑，全面以用户目录下的中央配置文件 `~/.ycc/config.json` 为唯一数据源；
  - [x] 领域高内聚收敛重构：拆解平铺的 `storage.ts`、`workspace.ts` 与 `sandbox.ts`，独立出管理全局凭证的 `src/config.ts`，并将沙箱（`sandbox.ts`）、上下文工程（`context.ts`）、专属抽屉（`storage.ts`）与装配工厂（`index.ts`）统一收敛至 `src/workspace/` 领域目录，全量 73 个测试用例 100% 变绿通过；
  - [x] 践行文档全生命周期治理：新增 `docs/09-workspace-global-storage.md`，更新知识库索引与系统全景图。
