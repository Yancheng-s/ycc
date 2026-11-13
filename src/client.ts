import OpenAI from "openai";

try {
  process.loadEnvFile();
} catch {}

export const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

