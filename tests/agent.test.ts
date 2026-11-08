import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenAI from "openai";

let mockReplies: OpenAI.Chat.ChatCompletion[] = [];

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => mockReplies.shift()!,
      },
    };
  },
}));

process.env.OPENAI_MODEL ??= "gpt-4o-mini";
process.env.OPENAI_API_KEY ??= "mock-key";

import { chat as askAI } from "../src/main.js";

function textReply(content: string): OpenAI.Chat.ChatCompletion {
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

describe("runAgent", () => {
  it("无工具调用时直接返回文本", async () => {
    mockReplies = [textReply("你好！")];

    const result = await askAI("hi");

    expect(result).toBe("你好！");
  });
});
