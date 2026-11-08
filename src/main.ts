import OpenAI from "openai";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";

try {
  process.loadEnvFile();
} catch {}

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL;

export async function chat(
  userMessage: string,
  history: OpenAI.Chat.ChatCompletionMessageParam[] = []
): Promise<string> {
  if (!MODEL) {
    throw new Error("缺少模型配置：请在环境变量中设置 OPENAI_MODEL");
  }

  history.push({ role: "user", content: userMessage });

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: history,
  });

  const content = res.choices[0].message.content;
  if (!content) {
    return "";
  }

  history.push({ role: "assistant", content });
  return content;
}

const isEntry =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntry) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("错误：未检测到 API Key，请在 .env 中设置 OPENAI_API_KEY");
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  console.log("进入多轮对话模式，输入 exit 退出。\n");

  const runCli = async () => {
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
      console.log(`[history]\n${JSON.stringify(history, null, 2)}\n`);
    }
  };

  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
