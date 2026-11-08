import { createInterface } from "node:readline/promises";
import type OpenAI from "openai";
import { chat } from "./main.js";

export async function runCli(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("错误：未检测到 API Key，请在 .env 中设置 OPENAI_API_KEY");
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  console.log("进入多轮对话模式，输入 exit 退出。\n");

  while (true) {
    const input = await rl.question("你: ");
    if (input.trim() === "exit") {
      rl.close();
      break;
    }
    if (!input.trim()) {
      continue;
    }
    const answer = await chat(input, history);
    console.log(`\nAI: ${answer}\n`);
  }
}

