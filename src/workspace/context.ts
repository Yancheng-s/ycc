import os from "node:os";
import type OpenAI from "openai";

export function buildSystemPrompt(root: string, customPrompt?: string): string {
  if (customPrompt !== undefined) {
    return customPrompt;
  }
  return [
    `你是 Harness Agent，运行在以 Workspace 为中心的环境中。`,
    `- 当前操作系统: ${os.platform()}`,
    `- 授权工作空间根目录: ${root}`,
    `- 行为与安全准则: 你的所有文件与命令操作受安全沙箱保护，严禁越界访问工作空间之外的文件。`,
    `- 黑板机制: 工作空间即是你的协作黑板。遇到不确定的代码或任务时，优先调用 list_directory 或 read_file 自主检索事实；在黑板上创建或修改文件时，保证原子性与准确性。`,
  ].join("\n");
}

export function assembleContext(
  history: OpenAI.Chat.ChatCompletionMessageParam[],
  systemPrompt?: string,
  options?: {
    maxToolOutputLength?: number;
  }
): OpenAI.Chat.ChatCompletionMessageParam[] {
  let threshold = 300;
  if (options && options.maxToolOutputLength !== undefined) {
    threshold = options.maxToolOutputLength;
  }

  let lastAssistantWithToolsIndex = -1;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      lastAssistantWithToolsIndex = i;
      break;
    }
  }

  const assembled: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (systemPrompt && systemPrompt.trim()) {
    assembled.push({
      role: "system",
      content: systemPrompt,
    });
  }

  for (let i = 0; i < history.length; i += 1) {
    const msg = history[i];
    if (msg.role === "system") {
      if (!systemPrompt || !systemPrompt.trim()) {
        assembled.push(msg);
      }
      continue;
    }

    if (msg.role === "tool") {
      const isLatest = lastAssistantWithToolsIndex !== -1 && i > lastAssistantWithToolsIndex;
      if (!isLatest && typeof msg.content === "string" && msg.content.length > threshold) {
        const prefix = msg.content.slice(0, 100);
        const suffix = msg.content.slice(-50);
        assembled.push({
          role: "tool",
          tool_call_id: msg.tool_call_id,
          content: `${prefix}\n...[已压缩历史工具输出，原始共 ${msg.content.length} 字符]...\n${suffix}`,
        });
        continue;
      }
    }

    assembled.push(msg);
  }

  return assembled;
}

