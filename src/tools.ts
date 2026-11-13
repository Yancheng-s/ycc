import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

export const timeTool: Tool = {
  name: "get_current_time",
  description: "获取系统当前的真实日期和时间",
  execute: () => {
    const now = new Date();
    return now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  },
};

export const runCommandTool: Tool = {
  name: "run_command",
  description: "在本地终端中执行命令行指令并返回输出",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的命令行指令",
      },
    },
    required: ["command"],
  },
  execute: async (args) => {
    const command = args.command;
    if (typeof command !== "string" || !command.trim()) {
      return "Error: command 参数必须是非空字符串";
    }

    let shell = "bash";
    if (process.platform === "win32") {
      shell = "powershell.exe";
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        shell,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });

      let output = stdout;
      if (!output && stderr) {
        output = stderr;
      }
      if (!output) {
        output = "命令执行完成，无输出。";
      }

      const maxLen = 2000;
      if (output.length > maxLen) {
        output = output.slice(0, maxLen) + "\n...[输出过长已截断]";
      }
      return output;
    } catch (err: unknown) {
      if (err instanceof Error) {
        return `执行出错: ${err.message}`;
      }
      return "执行命令时发生未知错误";
    }
  },
};

export const defaultTools: Tool[] = [timeTool, runCommandTool];
