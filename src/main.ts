import OpenAI from "openai";
import { pathToFileURL } from "node:url";

try {
  process.loadEnvFile();
} catch { }

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL;

export async function chat(userMessage: string): Promise<string> {
  if (!MODEL) {
    throw new Error("缺少模型配置：请在环境变量中设置 OPENAI_MODEL");
  }

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: userMessage }],
  });

  console.log(JSON.stringify(res, null, 2));

  const content = res.choices[0].message.content;
  if (!content) {
    return "";
  }
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

  const question = process.argv[2] || "一艘船上有75头牛，32只羊，船长多少岁？";
  console.log(`[user] ${question}\n`);

  chat(question)
    .then((answer) => console.log(`[assistant]\n${answer}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
