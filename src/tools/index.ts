import type { Tool } from "../types.js";
import { timeTool } from "./time.js";
import { runCommandTool, createShellTool } from "./shell.js";
import { createFsTools } from "./fs.js";

export { timeTool, runCommandTool, createShellTool, createFsTools };

export const defaultTools: Tool[] = [
  timeTool,
  runCommandTool,
  ...createFsTools(),
];
