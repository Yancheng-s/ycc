import OpenAI from "openai";
import { pathToFileURL } from "node:url";
import { runCli } from "./cli.js";

try {
  process.loadEnvFile();
} catch {}

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chat(
  userMessage: string,
  history: OpenAI.Chat.ChatCompletionMessageParam[] = []
): Promise<string> {
  const model = process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("缺少模型配置：请在环境变量中设置 OPENAI_MODEL");
  }

  history.push({ role: "user", content: userMessage });

  const res = await client.chat.completions.create({
    model,
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
  runCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
