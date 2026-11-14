import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { WorkspaceHooks, Tool, Workspace } from "./types.js";
import { timeTool } from "./tools/time.js";
import { createShellTool } from "./tools/shell.js";
import { createFsTools } from "./tools/fs.js";

export function findProjectRoot(startDir: string = process.cwd()): string {
  const home = path.resolve(os.homedir());
  let current = path.resolve(startDir);

  while (true) {
    if (current === home && path.resolve(startDir) !== home) {
      break;
    }

    const gitPath = path.join(current, ".git");
    const pkgPath = path.join(current, "package.json");

    if (fs.existsSync(gitPath) || fs.existsSync(pkgPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path.resolve(startDir);
}

export function createWorkspace(options?: {
  root?: string;
  tools?: Tool[];
  systemPrompt?: string;
  hooks?: WorkspaceHooks | WorkspaceHooks[];
  maxTurns?: number;
}): Workspace {
  let root = findProjectRoot();
  if (options && options.root) {
    root = path.resolve(options.root);
  }

  let tools: Tool[] = [];
  if (options && options.tools) {
    tools = options.tools;
  } else {
    const fsTools = createFsTools(root);
    const shellTool = createShellTool(root);
    tools = [timeTool, shellTool, ...fsTools];
  }

  let systemPrompt = [
    `你是 Harness Agent，运行在以 Workspace 为中心的环境中。`,
    `- 当前操作系统: ${os.platform()}`,
    `- 授权工作空间根目录: ${root}`,
    `- 行为与安全准则: 你的所有文件与命令操作受安全沙箱保护，严禁越界访问工作空间之外的文件。`,
    `- 黑板机制: 工作空间即是你的协作黑板。遇到不确定的代码或任务时，优先调用 list_directory 或 read_file 自主检索事实；在黑板上创建或修改文件时，保证原子性与准确性。`,
  ].join("\n");
  if (options && options.systemPrompt !== undefined) {
    systemPrompt = options.systemPrompt;
  }

  let hooks: WorkspaceHooks | WorkspaceHooks[] | undefined = undefined;
  if (options && options.hooks) {
    hooks = options.hooks;
  }

  let maxTurns = 5;
  if (options && options.maxTurns !== undefined) {
    maxTurns = options.maxTurns;
  }

  return {
    root,
    tools,
    systemPrompt,
    hooks,
    maxTurns,
  };
}
