#!/usr/bin/env node
import { runCli, handleInit } from "./cli.js";

export { chat } from "./agent.js";
export { client, getClient, getClientForProvider, resetClient } from "./client.js";
export {
  createWorkspace,
  findProjectRoot,
  resolveInWorkspace,
  buildSystemPrompt,
  getProjectFingerprint,
  getWorkspaceStorageDir,
  ensureWorkspaceStorage,
  saveSession,
  loadSession,
  listSessions,
} from "./workspace/index.js";
export {
  getYccHome,
  ensureGlobalStorage,
  loadGlobalConfig,
  saveGlobalConfig,
  resolveProvider,
  normalizeBaseURL,
} from "./config.js";
export { runCli, handleInit } from "./cli.js";
export type {
  Tool,
  Workspace,
  WorkspaceHooks,
  GlobalConfig,
  ProviderConfig,
  GlobalStorageInfo,
  WorkspaceStorageInfo,
} from "./types.js";

runCli().catch((err) => {
  console.error(err);
  process.exit(1);
});
