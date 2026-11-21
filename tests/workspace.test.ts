import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import {
  createWorkspace,
  findProjectRoot,
  buildSystemPrompt,
  assembleContext,
} from "../src/workspace/index.js";
import type { WorkspaceHooks, Tool } from "../src/types.js";

describe("findProjectRoot", () => {
  it("在子目录中向上回溯找到包含 package.json 的根目录", () => {
    const subDir = path.join(process.cwd(), "src");
    const root = findProjectRoot(subDir);
    expect(root).toBe(process.cwd());
  });

  it("当未找到任何项目标志时退回给定的起始目录", async () => {
    const tempDir = path.join(os.tmpdir(), `harness_test_root_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    try {
      const root = findProjectRoot(tempDir);
      expect(root).toBe(tempDir);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("createWorkspace", () => {
  it("默认创建当前工作目录的工作空间", () => {
    const ws = createWorkspace();
    expect(ws.root).toBe(process.cwd());
    expect(ws.tools.length).toBe(5);
    expect(ws.tools.map((t) => t.name)).toEqual([
      "get_current_time",
      "run_command",
      "read_file",
      "write_file",
      "list_directory",
    ]);
  });

  it("支持自定义绝对与相对工作空间路径", () => {
    const customRelative = "custom_dir";
    const ws = createWorkspace({ root: customRelative });
    expect(ws.root).toBe(path.resolve(customRelative));
  });

  it("默认初始化专属的全局 storageDir 并支持自定义覆盖", () => {
    const ws = createWorkspace();
    expect(ws.storageDir).toBeDefined();
    expect(typeof ws.storageDir).toBe("string");

    const customStorage = path.resolve("custom_storage");
    const wsCustom = createWorkspace({ storageDir: customStorage });
    expect(wsCustom.storageDir).toBe(customStorage);
  });

  it("动态生成包含操作系统与根路径的环境上下文 System Prompt", () => {
    const customRoot = path.resolve("my_project");
    const ws = createWorkspace({ root: customRoot });

    expect(ws.systemPrompt).toContain("你是 Harness Agent");
    expect(ws.systemPrompt).toContain(`- 当前操作系统: ${os.platform()}`);
    expect(ws.systemPrompt).toContain(`- 授权工作空间根目录: ${customRoot}`);
    expect(ws.systemPrompt).toContain("- 行为与安全准则:");
    expect(ws.systemPrompt).toContain("- 黑板机制:");
  });

  it("支持挂载单个或数组形式的 WorkspaceHooks", () => {
    const hook1: WorkspaceHooks = { onToolExecute: () => {} };
    const hook2: WorkspaceHooks = { beforeToolExecute: () => true };

    const ws1 = createWorkspace({ hooks: hook1 });
    expect(ws1.hooks).toBe(hook1);

    const ws2 = createWorkspace({ hooks: [hook1, hook2] });
    expect(ws2.hooks).toEqual([hook1, hook2]);
  });

  it("支持自定义 tools 与 systemPrompt 覆盖", () => {
    const customTool: Tool = {
      name: "custom",
      description: "custom desc",
      execute: () => "ok",
    };
    const ws = createWorkspace({
      tools: [customTool],
      systemPrompt: "custom prompt",
    });

    expect(ws.tools).toEqual([customTool]);
    expect(ws.systemPrompt).toBe("custom prompt");
  });

  it("buildSystemPrompt 正确组装默认提示词并支持覆盖", () => {
    const prompt = buildSystemPrompt("C:/my_project");
    expect(prompt).toContain("C:/my_project");
    expect(prompt).toContain(os.platform());
    expect(prompt).toContain("黑板机制");

    const custom = buildSystemPrompt("C:/my_project", "custom text");
    expect(custom).toBe("custom text");
  });
});

describe("assembleContext", () => {
  it("确保 systemPrompt 作为首条消息且不重复", () => {
    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: "旧的提示词" },
      { role: "user", content: "你好" },
    ];
    const messages = assembleContext(history, "最新的工作空间指令");
    expect(messages.length).toBe(2);
    expect(messages[0]).toEqual({
      role: "system",
      content: "最新的工作空间指令",
    });
    expect(messages[1]).toEqual({
      role: "user",
      content: "你好",
    });
  });

  it("保留最新轮次的工具输出不被压缩，且对早期长工具输出进行轻量压缩", () => {
    const longOutput = "a".repeat(400);
    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "user", content: "执行第一步" },
      {
        role: "assistant",
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "read_file", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call-1",
        content: longOutput,
      },
      { role: "assistant", content: "第一步完成，准备第二步" },
      {
        role: "assistant",
        tool_calls: [
          {
            id: "call-2",
            type: "function",
            function: { name: "write_file", arguments: "{}" },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call-2",
        content: longOutput,
      },
    ];

    const messages = assembleContext(history, undefined, {
      maxToolOutputLength: 200,
    });

    const oldToolMsg = messages[2];
    expect(oldToolMsg.role).toBe("tool");
    if (oldToolMsg.role === "tool") {
      expect(oldToolMsg.tool_call_id).toBe("call-1");
      expect(oldToolMsg.content).toContain("已压缩历史工具输出，原始共 400 字符");
      expect(oldToolMsg.content.length).toBeLessThan(longOutput.length);
    }

    const latestToolMsg = messages[5];
    expect(latestToolMsg.role).toBe("tool");
    if (latestToolMsg.role === "tool") {
      expect(latestToolMsg.tool_call_id).toBe("call-2");
      expect(latestToolMsg.content).toBe(longOutput);
    }
  });
});
