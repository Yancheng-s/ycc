import type OpenAI from "openai";
import { client } from "./client.js";
import type { Tool, ChatOptions } from "./types.js";
import { HookDispatcher } from "./dispatcher.js";

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

  const dispatcher = new HookDispatcher(options.hooks);

  let turns = 0;
  while (turns < maxTurns) {
    turns += 1;

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model,
      messages: history,
      stream: true,
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

    dispatcher.onLLMRequest(turns, params);

    const stream = await client.chat.completions.create(params);

    let accumulatedContent = "";
    const toolCallsMap: Map<number, OpenAI.Chat.ChatCompletionMessageToolCall> = new Map();
    let streamId = "";
    let streamModel = "";
    let streamCreated = 0;

    for await (const chunk of stream) {
      dispatcher.onStreamChunk(chunk);

      if (chunk.id) {
        streamId = chunk.id;
      }
      if (chunk.model) {
        streamModel = chunk.model;
      }
      if (chunk.created) {
        streamCreated = chunk.created;
      }

      const choice = chunk.choices[0];
      if (!choice) {
        continue;
      }

      const delta = choice.delta;
      if (delta.content) {
        accumulatedContent += delta.content;
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index;
          let current = toolCallsMap.get(index);
          if (!current) {
            current = {
              id: tc.id || "",
              type: "function",
              function: {
                name: tc.function && tc.function.name ? tc.function.name : "",
                arguments: tc.function && tc.function.arguments ? tc.function.arguments : "",
              },
            };
            toolCallsMap.set(index, current);
          } else {
            if (tc.id) {
              current.id += tc.id;
            }
            if (tc.function) {
              if (tc.function.name) {
                current.function.name += tc.function.name;
              }
              if (tc.function.arguments) {
                current.function.arguments += tc.function.arguments;
              }
            }
          }
        }
      }
    }

    const assembledToolCalls = Array.from(toolCallsMap.values());
    const hasToolCalls = assembledToolCalls.length > 0;

    const assembledResponse: OpenAI.Chat.ChatCompletion = {
      id: streamId || "chatcmpl-stream",
      object: "chat.completion",
      created: streamCreated || Math.floor(Date.now() / 1000),
      model: streamModel || model,
      choices: [
        {
          index: 0,
          finish_reason: hasToolCalls ? "tool_calls" : "stop",
          message: {
            role: "assistant",
            content: accumulatedContent ? accumulatedContent : null,
            tool_calls: hasToolCalls ? assembledToolCalls : undefined,
            refusal: null,
          },
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };

    dispatcher.onLLMResponse(turns, assembledResponse);

    if (hasToolCalls) {
      const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: "assistant",
      };
      if (accumulatedContent) {
        assistantMsg.content = accumulatedContent;
      }
      assistantMsg.tool_calls = assembledToolCalls;
      history.push(assistantMsg);

      for (const call of assembledToolCalls) {
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
          const allowed = await dispatcher.beforeToolExecute(
            call.function.name,
            args
          );
          if (!allowed) {
            result = `Error: User or security guard rejected execution of tool ${call.function.name}`;
          } else {
            result = await targetTool.execute(args);
          }
        }

        dispatcher.onToolExecute(call.function.name, args, result, call.id);

        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      continue;
    }

    if (!accumulatedContent) {
      return "";
    }

    history.push({ role: "assistant", content: accumulatedContent });
    return accumulatedContent;
  }

  return "已达到最大执行轮数上限";
}
