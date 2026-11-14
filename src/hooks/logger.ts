import type { AgentHooks } from "../types.js";

export const consoleLogger: AgentHooks = {
  onLLMRequest: (turn, params) => {
    console.log("\n──────────────────────────────────────────────────");
    console.log(`[第 ${turn} 轮 · 请求大模型]`);
    console.log("--- 发送完整请求参数 (Request Payload) ---");
    console.log(JSON.stringify(params, null, 2));
    // console.log("--- 原始流式数据切片 (Raw Stream Chunks) ---");
  },
  // onStreamChunk: (chunk) => {
  //   console.log(JSON.stringify(chunk));
  // },
  onLLMResponse: (_turn, res) => {
    console.log("--- 接收完整响应报文 (Response Payload) ---");
    console.log(JSON.stringify(res, null, 2));
    const firstChoice = res.choices[0];
    if (
      !firstChoice ||
      !firstChoice.message.tool_calls ||
      firstChoice.message.tool_calls.length === 0
    ) {
      console.log("──────────────────────────────────────────────────\n");
    }
  },
  onToolExecute: (name, args, result, id) => {
    console.log(`--- 工具执行详情 [${name}] ---`);
    console.log(`调用 ID: ${id}`);
    console.log(`输入参数: ${JSON.stringify(args)}`);
    console.log(`输出结果: ${result}`);
    console.log("──────────────────────────────────────────────────\n");
  },
};
