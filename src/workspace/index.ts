import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type { Tool, Workspace, WorkspaceHooks } from "../types.js";
import { timeTool } from "../tools/time.js";
import { createShellTool } from "../tools/shell.js";
import { createFsTools } from "../tools/fs.js";
import { resolveInWorkspace } from "./sandbox.js";
import { buildSystemPrompt } from "./context.js";
import {
  ensureWorkspaceStorage,
  getProjectFingerprint,
  getWorkspaceStorageDir,
  saveSession,
  loadSession,
  listSessions,
} from "./storage.js";

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
  storageDir?: string;
  tools?: Tool[];
  systemPrompt?: string;
  hooks?: WorkspaceHooks | WorkspaceHooks[];
  maxTurns?: number;
}): Workspace {
  let root = findProjectRoot();
  if (options && options.root) {
    root = path.resolve(options.root);
  }

  let storageDir = "";
  if (options && options.storageDir) {
    storageDir = path.resolve(options.storageDir);
  } else {
    storageDir = ensureWorkspaceStorage(root).storageDir;
  }

  let tools: Tool[] = [];
  if (options && options.tools) {
    tools = options.tools;
  } else {
    const fsTools = createFsTools(root);
    const shellTool = createShellTool(root);
    tools = [timeTool, shellTool, ...fsTools];
  }

  let customPrompt: string | undefined = undefined;
  if (options && options.systemPrompt !== undefined) {
    customPrompt = options.systemPrompt;
  }
  const systemPrompt = buildSystemPrompt(root, customPrompt);

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
    storageDir,
    tools,
    systemPrompt,
    hooks,
    maxTurns,
  };
}

export {
  resolveInWorkspace,
  buildSystemPrompt,
  getProjectFingerprint,
  getWorkspaceStorageDir,
  ensureWorkspaceStorage,
  saveSession,
  loadSession,
  listSessions,
};
