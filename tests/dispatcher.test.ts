import { describe, it, expect, vi } from "vitest";
import { HookDispatcher } from "../src/dispatcher.js";
import type OpenAI from "openai";

describe("HookDispatcher", () => {
  const sampleChunk: OpenAI.Chat.ChatCompletionChunk = {
    id: "chunk-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        delta: { content: "test" },
        finish_reason: null,
      },
    ],
  };

  it("未传入 hooks 时安全空转不报错", () => {
    const dispatcher = new HookDispatcher();

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    };
    const res: OpenAI.Chat.ChatCompletion = {
      id: "test-id",
      object: "chat.completion",
      created: 0,
      model: "test-model",
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    expect(() => dispatcher.onLLMRequest(1, params)).not.toThrow();
    expect(() => dispatcher.onStreamChunk(sampleChunk)).not.toThrow();
    expect(() => dispatcher.onLLMResponse(1, res)).not.toThrow();
    expect(() =>
      dispatcher.onToolExecute("test", {}, "ok", "call-1")
    ).not.toThrow();
  });

  it("支持单个 Hook 对象订阅并成功触发", () => {
    const onRequest = vi.fn();
    const onChunk = vi.fn();
    const onResponse = vi.fn();
    const onTool = vi.fn();

    const dispatcher = new HookDispatcher({
      onLLMRequest: onRequest,
      onStreamChunk: onChunk,
      onLLMResponse: onResponse,
      onToolExecute: onTool,
    });

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    };
    const res: OpenAI.Chat.ChatCompletion = {
      id: "test-id",
      object: "chat.completion",
      created: 0,
      model: "test-model",
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    dispatcher.onLLMRequest(1, params);
    dispatcher.onStreamChunk(sampleChunk);
    dispatcher.onLLMResponse(1, res);
    dispatcher.onToolExecute("demo", { a: 1 }, "res", "id-1");

    expect(onRequest).toHaveBeenCalledWith(1, params);
    expect(onChunk).toHaveBeenCalledWith(sampleChunk);
    expect(onResponse).toHaveBeenCalledWith(1, res);
    expect(onTool).toHaveBeenCalledWith("demo", { a: 1 }, "res", "id-1");
  });

  it("支持多个 Hook 数组订阅并依次多重广播", () => {
    const log1 = vi.fn();
    const log2 = vi.fn();

    const dispatcher = new HookDispatcher([
      { onStreamChunk: log1 },
      { onStreamChunk: log2 },
    ]);

    dispatcher.onStreamChunk(sampleChunk);

    expect(log1).toHaveBeenCalledWith(sampleChunk);
    expect(log2).toHaveBeenCalledWith(sampleChunk);
  });
});
