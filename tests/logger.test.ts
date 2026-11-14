import { describe, it, expect, vi } from "vitest";
import { consoleLogger } from "../src/logger.js";
import type OpenAI from "openai";

describe("consoleLogger", () => {
  it("onLLMRequest 格式化输出轮数和请求参数", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      stream: true,
    };

    if (consoleLogger.onLLMRequest) {
      consoleLogger.onLLMRequest(1, params);
    }

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("第 1 轮 · 请求大模型"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("gpt-4o-mini"));
    spy.mockRestore();
  });

  it("onStreamChunk 打印原始数据切片 JSON", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const mockChunk: OpenAI.Chat.ChatCompletionChunk = {
      id: "chunk-1",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: { content: "片段" },
          finish_reason: null,
        },
      ],
    };

    if (consoleLogger.onStreamChunk) {
      consoleLogger.onStreamChunk(mockChunk);
    }

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("chunk-1"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("片段"));
    spy.mockRestore();
  });

  it("onLLMResponse 格式化输出响应报文并在无工具调用时输出底部分割线", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const res: OpenAI.Chat.ChatCompletion = {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: "hello", refusal: null },
          logprobs: null,
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    };

    if (consoleLogger.onLLMResponse) {
      consoleLogger.onLLMResponse(1, res);
    }

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("接收完整响应报文"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("──────────────────────────────────────────────────\n"));
    spy.mockRestore();
  });

  it("onToolExecute 格式化输出工具调用详情", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    if (consoleLogger.onToolExecute) {
      consoleLogger.onToolExecute(
        "run_command",
        { command: "dir" },
        "dir-result",
        "call-123"
      );
    }

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("工具执行详情 [run_command]"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("call-123"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("dir-result"));
    spy.mockRestore();
  });
});
