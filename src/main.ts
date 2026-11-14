import { runCli } from "./cli.js";

export { chat } from "./agent.js";
export { client } from "./client.js";
export { createWorkspace, findProjectRoot } from "./workspace.js";
export type { Tool, Workspace, WorkspaceHooks } from "./types.js";

runCli().catch((err) => {
  console.error(err);
  process.exit(1);
});
