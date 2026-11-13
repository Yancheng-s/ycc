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

  let verbose = false;
  if (options.verbose !== undefined) {
    verbose = options.verbose;
  }

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

    if (verbose) {
      console.log(`\n──────────────────────────────────────────────────`);
      console.log(`[第 ${turns} 轮 · 请求大模型]`);
      console.log(`--- 发送完整请求参数 (Request Payload) ---`);
      console.log(JSON.stringify(params, null, 2));
    }

    const res = await client.chat.completions.create(params);
    const message = res.choices[0].message;

    if (verbose) {
      console.log(`--- 接收完整响应报文 (Response Payload) ---`);
      console.log(JSON.stringify(res, null, 2));
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
        if (!targetTool) {
          result = `Error: Tool ${call.function.name} not found`;
        } else {
          let args: Record<string, unknown> = {};
          if (call.function.arguments) {
            try {
              args = JSON.parse(call.function.arguments);
            } catch {
              args = {};
            }
          }
          result = await targetTool.execute(args);
        }

        if (verbose) {
          console.log(`--- 工具执行详情 [${call.function.name}] ---`);
          console.log(`调用 ID: ${call.id}`);
          console.log(`输入参数: ${call.function.arguments}`);
          console.log(`输出结果: ${result}`);
        }

        history.push({
          role: "tool",
          tool_call_id: call.id,
          content: result,
        });
      }

      if (verbose) {
        console.log(`──────────────────────────────────────────────────\n`);
      }
      continue;
    }

    if (verbose) {
      console.log(`──────────────────────────────────────────────────\n`);
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

