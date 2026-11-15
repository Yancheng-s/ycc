# Harness Agent 知识库与架构设计文档

本目录记录 Harness Agent 项目在演进过程中沉淀的核心**设计理念、架构模式与工程规范**。文档随系统自然生长，作为后续扩展与团队协作的技术基石。

---

## 知识库索引与模块导航

| 序号 | 文档名称 | 核心知识点与设计范式 |
| :--- | :--- | :--- |
| **01** | [加尔定律与系统自然生长法则](./01-philosophy-evolution.md) | 复杂系统演进哲学、反过早设计、5 阶段自然生长模型 |
| **02** | [Agent 受控循环与对话记忆](./02-agent-loop-memory.md) | ReAct 工具调用循环、上下文记忆栈、最大轮次熔断保护 |
| **03** | [工具契约规范与沙箱安全防护](./03-tool-contract-security.md) | JSON Schema 工具标准、PowerShell 执行器、超时与截断双保险 |
| **04** | [生命周期 Hook 管道与分发器模式](./04-lifecycle-hooks-dispatcher.md) | 控制反转（IoC）、空对象模式（Null Object）、多重广播、内核纯净化 |
| **05** | [编码规范约束与质量门禁](./05-code-quality-testing.md) | 零注释自解释原则、严禁 `??` 隐式兜底、三位一体自动化门禁 |
| **06** | [流式传输与数据碎片组装](./06-streaming-chunk-assembly.md) | Server-Sent Events 流式迭代、文本打字机与工具 JSON 碎片双轨处理、多端解耦 |
| **07** | [人机交互安全守卫与拦截型 Hook](./07-human-in-the-loop-guard.md) | Level 3 守卫型 Hook、一票否决权（beforeToolExecute）、短路拦截、src/hooks 物理隔离 |
| **08** | [Workspace 容器、沙箱隔离与环境上下文架构](./08-workspace-sandbox-context.md) | 控制反转（IoC）、MUD 房间范式、沙箱防越界守卫、环境即通信总线（黑板模式） |
| **09** | [非侵入式项目全局持久化与工作区映射架构](./09-workspace-global-storage.md) | 代码库零污染哲学（~/.ycc/）、路径指纹算法（Path Fingerprinting）、会话持久化与草稿区 |
| **10** | [多模型服务商架构与控制面解耦](./10-multi-provider-architecture.md) | 控制面与数据面分离、current 活跃指针 + providers 字典拓扑、动态客户端连接池、零兼容演进 |

---

## 系统全景架构图

```mermaid
flowchart TD
    User(["用户 (终端 CLI / API)"]) --> CLI["src/cli.ts (终端交互入口)"]

    subgraph WorkspaceContainer ["Workspace 容器 (Room / 能力沙箱与环境上下文)"]
        Context["环境上下文装配 (System Context: OS / Root Path / Rules)"]
        Sandbox["沙箱越界守卫 (resolveInWorkspace)"]
        
        subgraph ToolsGroup ["受控工具层 (Mounted Tools)"]
            FSTools["文件系统工具 (read_file / write_file / list_dir)"]
            ShellTool["终端工具 (run_command: PowerShell 宿主)"]
            TimeTool["时间工具 (get_current_time)"]
            Safety["安全熔断 (10s 超时 / 2000 字符截断)"]
            ShellTool --> Safety
        end
    end

    subgraph Kernel ["Agent 调度内核 (Pure Streaming Engine)"]
        Agent["src/agent.ts (受控调度引擎)"]
        Dispatcher["src/dispatcher.ts (HookDispatcher)"]
        Client["src/client.ts (OpenAI 客户端)"]
        Assembler["内存碎片拼装器 (ToolCallsMap)"]
        Memory[("MessageParam[] (上下文记忆栈)")]

        Agent --> Dispatcher
        Agent --> Client
        Agent --> Assembler
        Agent --> Memory
    end

    subgraph Plugins ["src/hooks/ 插件扩展专区 (Plugins)"]
        Dispatcher -. 实时 Chunk 广播 .-> Logger["src/hooks/logger.ts (consoleLogger)"]
        Dispatcher == "beforeToolExecute (一票否决)" ==> Guard["src/hooks/guard.ts (cliGuard 人机确认)"]
        Guard -. 提问确认 .-> User
        Dispatcher -. 扩展广播 .-> Monitor["多前端扩展 (Web SSE / WebSocket)"]
    end

    CLI --> WorkspaceContainer
    WorkspaceContainer -->|注入环境上下文与沙箱边界| Agent
    Agent -->|工具调用调度| Sandbox
    Sandbox -->|防越界合法校验| ToolsGroup
    ToolsGroup --> TargetDisk[("工作区物理磁盘 (Active Workspace)")]

    Client -->|stream: true| LLM["大模型服务端 (Spark / OpenAI)"]
    Logger --> ConsoleOutput(["终端实时报文与切片输出"])
```
