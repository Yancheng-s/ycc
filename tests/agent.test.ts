import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenAI from "openai";

let mockReplies: (OpenAI.Chat.ChatCompletion | Error)[] = [];

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => {
          const item = mockReplies.shift();
          if (item instanceof Error) {
            throw item;
          }
          return item;
        },
      },
    };
  },
}));

if (!process.env.OPENAI_MODEL) {
  process.env.OPENAI_MODEL = "gpt-4o-mini";
}
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "mock-key";
}

import { chat as askAI, Tool } from "../src/main.js";

function textReply(content: string | null): OpenAI.Chat.ChatCompletion {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content, refusal: null, tool_calls: undefined },
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function toolCallReply(
  calls: { id: string; name: string; arguments: string }[]
): OpenAI.Chat.ChatCompletion {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function",
            function: {
              name: c.name,
              arguments: c.arguments,
            },
          })),
        },
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

beforeEach(() => {
  mockReplies = [];
});

describe("chat", () => {
  it("单轮调用返回文本", async () => {
    mockReplies = [textReply("你好！")];

    const result = await askAI("hi");

    expect(result).toBe("你好！");
  });

  it("支持多轮对话并累积历史上下文", async () => {
    mockReplies = [
      textReply("你好，张三！"),
      textReply("你的名字是张三。"),
    ];

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    await askAI("我叫张三", history);
    const secondReply = await askAI("我叫什么？", history);

    expect(secondReply).toBe("你的名字是张三。");
    expect(history.length).toBe(4);
    expect(history[0]).toEqual({ role: "user", content: "我叫张三" });
    expect(history[1]).toEqual({ role: "assistant", content: "你好，张三！" });
    expect(history[2]).toEqual({ role: "user", content: "我叫什么？" });
    expect(history[3]).toEqual({ role: "assistant", content: "你的名字是张三。" });
  });

  it("未设置 OPENAI_MODEL 时抛出异常", async () => {
    const originalModel = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL;

    try {
      await expect(askAI("hi")).rejects.toThrow(
        "缺少模型配置：请在环境变量中设置 OPENAI_MODEL"
      );
    } finally {
      process.env.OPENAI_MODEL = originalModel;
    }
  });

  it("模型返回空内容时返回空字符串且不写入历史", async () => {
    mockReplies = [textReply(null)];

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI("hi", history);

    expect(result).toBe("");
    expect(history.length).toBe(1);
    expect(history[0]).toEqual({ role: "user", content: "hi" });
  });

  it("接口调用失败时向上抛出异常", async () => {
    mockReplies = [new Error("API Network Error")];

    await expect(askAI("hi")).rejects.toThrow("API Network Error");
  });

  it("支持工具调用循环并返回最终总结", async () => {
    const weatherTool: Tool = {
      name: "get_weather",
      description: "获取天气",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
      },
      execute: (args) => `${args.city}晴天，25度`,
    };

    mockReplies = [
      toolCallReply([
        {
          id: "call-1",
          name: "get_weather",
          arguments: JSON.stringify({ city: "北京" }),
        },
      ]),
      textReply("北京今天是晴天，气温25度。"),
    ];

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI("北京天气怎么样？", history, {
      tools: [weatherTool],
    });

    expect(result).toBe("北京今天是晴天，气温25度。");
    expect(history.length).toBe(4);
    expect(history[0]).toEqual({ role: "user", content: "北京天气怎么样？" });
    expect(history[1].role).toBe("assistant");
    expect(history[2]).toEqual({
      role: "tool",
      tool_call_id: "call-1",
      content: "北京晴天，25度",
    });
    expect(history[3]).toEqual({
      role: "assistant",
      content: "北京今天是晴天，气温25度。",
    });
  });

  it("当模型调用的工具不存在时回填错误信息并继续下一轮", async () => {
    mockReplies = [
      toolCallReply([
        {
          id: "call-unknown",
          name: "calc",
          arguments: "{}",
        },
      ]),
      textReply("未找到该计算工具。"),
    ];

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI("帮我算一下", history, { tools: [] });

    expect(result).toBe("未找到该计算工具。");
    expect(history.length).toBe(4);
    expect(history[2]).toEqual({
      role: "tool",
      tool_call_id: "call-unknown",
      content: "Error: Tool calc not found",
    });
  });

  it("超过最大轮数限制时停止循环并返回提示", async () => {
    mockReplies = [
      toolCallReply([
        {
          id: "call-loop-1",
          name: "loop",
          arguments: "{}",
        },
      ]),
      toolCallReply([
        {
          id: "call-loop-2",
          name: "loop",
          arguments: "{}",
        },
      ]),
    ];

    const loopTool: Tool = {
      name: "loop",
      description: "循环工具",
      execute: () => "looping",
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI("一直调工具", history, {
      tools: [loopTool],
      maxTurns: 2,
    });

    expect(result).toBe("已达到最大执行轮数上限");
  });
});
