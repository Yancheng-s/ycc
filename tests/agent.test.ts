import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenAI from "openai";

type MockReplyItem =
  | { [Symbol.asyncIterator]: () => AsyncIterator<OpenAI.Chat.ChatCompletionChunk> }
  | Error;

let mockReplies: MockReplyItem[] = [];

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => {
          const item = mockReplies.shift();
          if (!item) {
            throw new Error("No mock reply available");
          }
          if (item instanceof Error) {
            throw item;
          }
          return item;
        },
      },
    };
  },
}));

let mockProvider = {
  name: "mock-provider",
  apiKey: "mock-key",
  baseURL: "https://mock.openai.com/v1",
  model: "gpt-4o-mini",
};

vi.mock("../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config.js")>();
  return {
    ...actual,
    resolveProvider: (target?: string) => {
      if (!mockProvider.model) {
        throw new Error("缺少模型配置：当前服务商未配置 model 参数，请检查 ~/.ycc/config.json");
      }
      return {
        name: target || mockProvider.name,
        apiKey: mockProvider.apiKey,
        baseURL: mockProvider.baseURL,
        model: target ? `model-for-${target}` : mockProvider.model,
      };
    },
  };
});

import { chat as askAI } from "../src/agent.js";
import type { Tool, WorkspaceHooks, Workspace } from "../src/types.js";
import { createWorkspace } from "../src/workspace/index.js";

function textReply(content: string | null) {
  const chunks: OpenAI.Chat.ChatCompletionChunk[] = [];
  if (content === null) {
    chunks.push({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: null },
          finish_reason: "stop",
        },
      ],
    });
  } else {
    for (const char of content) {
      chunks.push({
        id: "chatcmpl-test",
        object: "chat.completion.chunk",
        created: 0,
        model: "gpt-4o-mini",
        choices: [
          {
            index: 0,
            delta: { content: char },
            finish_reason: null,
          },
        ],
      });
    }
    chunks.push({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
        },
      ],
    });
  }

  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        yield c;
      }
    },
  };
}

function toolCallReply(calls: { id: string; name: string; arguments: string }[]) {
  const chunks: OpenAI.Chat.ChatCompletionChunk[] = [];
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    chunks.push({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: i,
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: "" },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });

    const half = Math.floor(c.arguments.length / 2);
    chunks.push({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: i,
                function: { arguments: c.arguments.slice(0, half) },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
    chunks.push({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: i,
                function: { arguments: c.arguments.slice(half) },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
  }

  chunks.push({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "tool_calls",
      },
    ],
  });

  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) {
        yield c;
      }
    },
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

  it("未设置 model 配置时抛出异常", async () => {
    const originalModel = mockProvider.model;
    mockProvider.model = "";

    try {
      await expect(askAI("hi")).rejects.toThrow(
        "缺少模型配置：当前服务商未配置 model 参数，请检查 ~/.ycc/config.json"
      );
    } finally {
      mockProvider.model = originalModel;
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
    const result = await askAI(
      "北京天气怎么样？",
      history,
      createWorkspace({ tools: [weatherTool], systemPrompt: "" })
    );

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
    const result = await askAI(
      "帮我算一下",
      history,
      createWorkspace({ tools: [], systemPrompt: "" })
    );

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
      textReply("循环调用已结束并给出答案"),
    ];

    const loopTool: Tool = {
      name: "loop",
      description: "循环工具",
      execute: () => "looping",
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI(
      "一直调工具",
      history,
      createWorkspace({ tools: [loopTool], systemPrompt: "" })
    );

    expect(result).toBe("循环调用已结束并给出答案");
    expect(history.length).toBe(6);
  });

  it("触发生命周期 Hook 回调 (onLLMRequest 与 onLLMResponse)", async () => {
    mockReplies = [textReply("hook测试回复")];

    const onRequest = vi.fn();
    const onResponse = vi.fn();
    const hooks: WorkspaceHooks = {
      onLLMRequest: onRequest,
      onLLMResponse: onResponse,
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI(
      "你好",
      history,
      createWorkspace({ hooks, systemPrompt: "" })
    );

    expect(result).toBe("hook测试回复");
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ model: mockProvider.model, stream: true })
    );
    expect(onResponse).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ id: "chatcmpl-test" }));
  });

  it("执行工具时触发 onToolExecute Hook", async () => {
    const testTool: Tool = {
      name: "test_tool",
      description: "测试工具",
      execute: (args) => `executed with ${args.key}`,
    };

    mockReplies = [
      toolCallReply([
        {
          id: "call-tool-1",
          name: "test_tool",
          arguments: JSON.stringify({ key: "val" }),
        },
      ]),
      textReply("完成工具执行"),
    ];

    const onToolExecute = vi.fn();
    const hooks: WorkspaceHooks = { onToolExecute };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI(
      "运行工具",
      history,
      createWorkspace({ tools: [testTool], hooks, systemPrompt: "" })
    );

    expect(result).toBe("完成工具执行");
    expect(onToolExecute).toHaveBeenCalledTimes(1);
    expect(onToolExecute).toHaveBeenCalledWith(
      "test_tool",
      { key: "val" },
      "executed with val",
      "call-tool-1"
    );
  });

  it("支持传入 Hook 数组实现多重监听广播", async () => {
    mockReplies = [textReply("多hook测试回复")];

    const first = vi.fn();
    const second = vi.fn();

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI(
      "你好",
      history,
      createWorkspace({
        hooks: [{ onLLMResponse: first }, { onLLMResponse: second }],
        systemPrompt: "",
      })
    );

    expect(result).toBe("多hook测试回复");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("流式生成过程中实时触发 onStreamChunk 回调", async () => {
    mockReplies = [textReply("流式测试")];

    const onStreamChunk = vi.fn();
    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI(
      "测试",
      history,
      createWorkspace({ hooks: { onStreamChunk }, systemPrompt: "" })
    );

    expect(result).toBe("流式测试");
    expect(onStreamChunk).toHaveBeenCalledTimes(5);
    expect(onStreamChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "chatcmpl-test",
        choices: expect.any(Array),
      })
    );
  });

  it("当 beforeToolExecute 守卫拒绝时阻止工具执行并回填拦截信息", async () => {
    const dangerousTool: Tool = {
      name: "delete_database",
      description: "删除数据库",
      execute: vi.fn(),
    };

    mockReplies = [
      toolCallReply([
        {
          id: "call-del-1",
          name: "delete_database",
          arguments: "{}",
        },
      ]),
      textReply("操作被拒绝后的回复"),
    ];

    const rejectGuard: WorkspaceHooks = {
      beforeToolExecute: () => false,
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI(
      "删库",
      history,
      createWorkspace({
        tools: [dangerousTool],
        hooks: rejectGuard,
        systemPrompt: "",
      })
    );

    expect(result).toBe("操作被拒绝后的回复");
    expect(dangerousTool.execute).not.toHaveBeenCalled();
    expect(history.length).toBe(4);
    expect(history[2]).toEqual({
      role: "tool",
      tool_call_id: "call-del-1",
      content:
        "Error: User or security guard rejected execution of tool delete_database",
    });
  });

  it("当提供 workspace 时自动在历史消息头部注入环境 System 提示词", async () => {
    mockReplies = [textReply("已就绪")];

    const mockWorkspace: Workspace = {
      root: "/mock/workspace",
      tools: [],
      systemPrompt: "系统环境上下文提示词",
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI("初始化", history, mockWorkspace);

    expect(result).toBe("已就绪");
    expect(history.length).toBe(3);
    expect(history[0]).toEqual({
      role: "system",
      content: "系统环境上下文提示词",
    });
    expect(history[1]).toEqual({
      role: "user",
      content: "初始化",
    });
    expect(history[2]).toEqual({
      role: "assistant",
      content: "已就绪",
    });
  });

  it("当历史消息已存在 system 角色时不再重复注入 workspace 提示词", async () => {
    mockReplies = [textReply("收到")];

    const mockWorkspace: Workspace = {
      root: "/mock/workspace",
      tools: [],
      systemPrompt: "新的系统提示词",
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: "已有系统提示词" },
    ];
    await askAI("继续", history, mockWorkspace);

    expect(history.length).toBe(3);
    expect(history[0]).toEqual({
      role: "system",
      content: "已有系统提示词",
    });
  });

  it("当未显式传递 tools 时自动使用 workspace 挂载的受控工具集", async () => {
    const wsTool: Tool = {
      name: "ws_tool",
      description: "工作空间内工具",
      execute: vi.fn().mockResolvedValue("工具执行成功"),
    };

    mockReplies = [
      toolCallReply([
        {
          id: "call-ws-1",
          name: "ws_tool",
          arguments: "{}",
        },
      ]),
      textReply("基于工具结果的总结"),
    ];

    const mockWorkspace: Workspace = {
      root: "/mock/workspace",
      tools: [wsTool],
      systemPrompt: "系统提示词",
    };

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const result = await askAI("调用空间工具", history, mockWorkspace);

    expect(result).toBe("基于工具结果的总结");
    expect(wsTool.execute).toHaveBeenCalled();
  });

  it("优先使用 targetModel 参数指定的服务商", async () => {
    mockReplies = [textReply("指定模型回复")];
    const onRequest = vi.fn();
    const hooks: WorkspaceHooks = { onLLMRequest: onRequest };
    const ws = createWorkspace({ hooks, systemPrompt: "", model: "workspace-provider" });

    const result = await askAI("hi", [], ws, "override-provider");

    expect(result).toBe("指定模型回复");
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ model: "model-for-override-provider" })
    );
  });

  it("未传 targetModel 时继承 workspace.model 指定的服务商", async () => {
    mockReplies = [textReply("继承模型回复")];
    const onRequest = vi.fn();
    const hooks: WorkspaceHooks = { onLLMRequest: onRequest };
    const ws = createWorkspace({ hooks, systemPrompt: "", model: "workspace-provider" });

    const result = await askAI("hi", [], ws);

    expect(result).toBe("继承模型回复");
    expect(onRequest).toHaveBeenCalledWith(
      expect.objectContaining({ model: "model-for-workspace-provider" })
    );
  });
});
