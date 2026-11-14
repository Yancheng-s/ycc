import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { createWorkspace, findProjectRoot } from "../src/workspace.js";
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

  it("默认配额为 5 轮，并支持自定义 maxTurns", () => {
    const wsDefault = createWorkspace();
    expect(wsDefault.maxTurns).toBe(5);

    const wsCustom = createWorkspace({ maxTurns: 10 });
    expect(wsCustom.maxTurns).toBe(10);
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
});
