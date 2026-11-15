import fs from "node:fs/promises";
import path from "node:path";
import { resolveInWorkspace } from "../workspace/sandbox.js";
import type { Tool } from "../types.js";

export function createFsTools(workspaceRoot?: string): Tool[] {
  let root = process.cwd();
  if (workspaceRoot) {
    root = workspaceRoot;
  }

  const readFileTool: Tool = {
    name: "read_file",
    description: "读取工作空间内指定文件的文本内容，受安全沙箱保护",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要读取的文件相对路径",
        },
      },
      required: ["path"],
    },
    execute: async (args) => {
      const rawPath = args.path;
      if (typeof rawPath !== "string" || !rawPath.trim()) {
        return "Error: path 参数必须是非空字符串";
      }

      let resolvedPath = "";
      try {
        resolvedPath = resolveInWorkspace(root, rawPath.trim());
      } catch {
        return `Security Error: Access denied. Path "${rawPath}" traverses outside workspace boundary.`;
      }

      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        const maxLen = 50000;
        if (content.length > maxLen) {
          return content.slice(0, maxLen) + "\n...[文件过长已截断]";
        }
        return content;
      } catch (err: unknown) {
        if (err instanceof Error) {
          const nodeErr = err as NodeJS.ErrnoException;
          if (nodeErr.code === "ENOENT") {
            return `Error: File "${rawPath}" does not exist. Please check the path.`;
          }
          if (nodeErr.code === "EISDIR") {
            return `Error: "${rawPath}" is a directory, not a file. Use list_directory instead.`;
          }
          if (nodeErr.code === "EACCES") {
            return `Error: Permission denied accessing "${rawPath}".`;
          }
          return `Error: Failed to read file: ${err.message}`;
        }
        return "Error: Failed to read file due to an unknown error";
      }
    },
  };

  const writeFileTool: Tool = {
    name: "write_file",
    description:
      "在工作空间内创建或覆盖写入文件，自动创建父级目录，受安全沙箱保护",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要写入的文件相对路径",
        },
        content: {
          type: "string",
          description: "要写入的完整文件文本内容",
        },
      },
      required: ["path", "content"],
    },
    execute: async (args) => {
      const rawPath = args.path;
      const content = args.content;

      if (typeof rawPath !== "string" || !rawPath.trim()) {
        return "Error: path 参数必须是非空字符串";
      }
      if (typeof content !== "string") {
        return "Error: content 参数必须是字符串";
      }

      let resolvedPath = "";
      try {
        resolvedPath = resolveInWorkspace(root, rawPath.trim());
      } catch {
        return `Security Error: Access denied. Path "${rawPath}" traverses outside workspace boundary.`;
      }

      try {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, "utf-8");
        return `成功写入文件: ${rawPath}`;
      } catch (err: unknown) {
        if (err instanceof Error) {
          return `Error: Failed to write file: ${err.message}`;
        }
        return "Error: Failed to write file due to an unknown error";
      }
    },
  };

  const listDirectoryTool: Tool = {
    name: "list_directory",
    description:
      "列出工作空间内指定目录下的文件与子目录列表，受安全沙箱保护",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要列出的目录相对路径，默认为工作空间根目录",
        },
      },
    },
    execute: async (args) => {
      let target = ".";
      if (typeof args.path === "string" && args.path.trim()) {
        target = args.path.trim();
      }

      let resolvedPath = "";
      try {
        resolvedPath = resolveInWorkspace(root, target);
      } catch {
        return `Security Error: Access denied. Path "${target}" traverses outside workspace boundary.`;
      }

      try {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        if (entries.length === 0) {
          return "目录为空。";
        }

        const formatted = entries
          .map((e) => {
            if (e.isDirectory()) {
              return `[DIR]  ${e.name}`;
            }
            return `[FILE] ${e.name}`;
          })
          .join("\n");

        return formatted;
      } catch (err: unknown) {
        if (err instanceof Error) {
          const nodeErr = err as NodeJS.ErrnoException;
          if (nodeErr.code === "ENOENT") {
            return `Error: Directory "${target}" does not exist.`;
          }
          if (nodeErr.code === "ENOTDIR") {
            return `Error: "${target}" is a file, not a directory. Use read_file instead.`;
          }
          return `Error: Failed to list directory: ${err.message}`;
        }
        return "Error: Failed to list directory due to an unknown error";
      }
    },
  };

  return [readFileTool, writeFileTool, listDirectoryTool];
}
