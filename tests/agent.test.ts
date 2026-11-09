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

import { chat as askAI } from "../src/main.js";

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
});
