import OpenAI from "openai";
import { pathToFileURL } from "node:url";

try {
  process.loadEnvFile?.();
} catch {}

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || process.env.LLM_MODEL;

const TOOL_SCHEMAS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "查询指定城市的实时天气",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "城市名称，例如：北京" },
        },
        required: ["city"],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name === "get_weather") {
    const city = args.city as string;
    return `${city}：晴，25℃，东南风 3 级，适合穿短袖。`;
  }
  return `错误：未知工具 "${name}"`;
}

export async function runAgent(userMessage: string): Promise<string> {
  if (!MODEL) {
    throw new Error("缺少模型配置：请在环境变量中设置 OPENAI_MODEL 或 LLM_MODEL");
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOL_SCHEMAS,
    });

    const msg = res.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? "";
    }

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
      console.log(`  [tool] ${call.function.name}(${JSON.stringify(args)})`);

      const result = await executeTool(call.function.name, args);

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }
}

const isEntry =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntry) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error("错误：未检测到 API Key，请在 .env 中设置 OPENAI_API_KEY 或 LLM_API_KEY");
    process.exit(1);
  }

  const question = process.argv[2] ?? "北京今天天气怎么样？该穿什么衣服？";
  console.log(`[user] ${question}\n`);

  runAgent(question)
    .then((answer) => console.log(`[agent]\n${answer}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
