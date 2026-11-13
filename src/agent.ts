import type OpenAI from "openai";
import { client } from "./client.js";
import type { Tool, ChatOptions } from "./types.js";

export async function chat(
  userMessage: string,
  history: OpenAI.Chat.ChatCompletionMessageParam[] = [],
  options: ChatOptions = {}
): Promise<string> {
  const model = process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("缺少模型配置：请在环境变量中设置 OPENAI_MODEL");
  }

  history.push({ role: "user", content: userMessage });

  let maxTurns = 5;
  if (options.maxTurns !== undefined) {
    maxTurns = options.maxTurns;
  }

  let toolList: Tool[] = [];
  if (options.tools) {
    toolList = options.tools;
  }

  const hooks = options.hooks;

  let turns = 0;
  while (turns < maxTurns) {
    turns += 1;

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: history,
    };

    if (toolList.length > 0) {
      params.tools = toolList.map((t) => {
        const def: OpenAI.Chat.ChatCompletionTool = {
          type: "function",
          function: {
            name: t.name,
            description: t.description,
          },
        };
        if (t.parameters) {
          def.function.parameters = t.parameters;
        }
        return def;
      });
    }

    if (hooks && hooks.onLLMRequest) {
      hooks.onLLMRequest(turns, params);
    }

    const res = await client.chat.completions.create(params);
    const message = res.choices[0].message;

    if (hooks && hooks.onLLMResponse) {
      hooks.onLLMResponse(turns, res);
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: "assistant",
      };
      if (message.content !== null && message.content !== undefined) {
        assistantMsg.content = message.content;
      }
      assistantMsg.tool_calls = message.tool_calls;
      history.push(assistantMsg);

      for (const call of message.tool_calls) {
        const targetTool = toolList.find((t) => t.name === call.function.name);
        let result = "";
        let args: Record<string, unknown> = {};
        if (call.function.arguments) {
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            args = {};
          }
        }

        if (!targetTool) {
          result = `Error: Tool ${call.function.name} not found`;
        } else {
          result = await targetTool.execute(args);
        }

        if (hooks && hooks.onToolExecute) {
          hooks.onToolExecute(call.function.name, args, result, call.id);
        }

        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      continue;
    }

    const content = message.content;
    if (!content) {
      return "";
    }

    history.push({ role: "assistant", content });
    return content;
  }

  return "已达到最大执行轮数上限";
}
