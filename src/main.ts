#!/usr/bin/env node
import { runCli, handleInit } from "./cli.js";

export { chat } from "./agent.js";
export { client } from "./client.js";
export { createWorkspace, findProjectRoot } from "./workspace.js";
export {
  getYccHome,
  getProjectFingerprint,
  getWorkspaceStorageDir,
  ensureWorkspaceStorage,
  ensureGlobalStorage,
  saveSession,
  loadSession,
  listSessions,
  loadGlobalConfig,
  saveGlobalConfig,
  resolveAppConfig,
  normalizeBaseURL,
} from "./storage.js";
export { runCli, handleInit } from "./cli.js";
export type {
  Tool,
  Workspace,
  WorkspaceHooks,
  GlobalConfig,
  GlobalStorageInfo,
  WorkspaceStorageInfo,
} from "./types.js";

runCli().catch((err) => {
  console.error(err);
  process.exit(1);
});
