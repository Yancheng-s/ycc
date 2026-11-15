import OpenAI from "openai";
import { normalizeBaseURL, resolveProvider } from "./config.js";

const clientPool = new Map<string, OpenAI>();

export function getClientForProvider(baseURL: string, apiKey: string): OpenAI {
  let cleanUrl = normalizeBaseURL(baseURL);
  if (!cleanUrl) {
    cleanUrl = "https://api.openai.com/v1";
  }
  let effectiveKey = apiKey;
  if (!effectiveKey) {
    effectiveKey = "placeholder-key-until-configured";
  }
  const cacheKey = `${cleanUrl}::${effectiveKey}`;
  let cached = clientPool.get(cacheKey);
  if (!cached) {
    cached = new OpenAI({
      baseURL: cleanUrl,
      apiKey: effectiveKey,
    });
    clientPool.set(cacheKey, cached);
  }
  return cached;
}

export function getClient(target?: string): OpenAI {
  try {
    const provider = resolveProvider(target);
    return getClientForProvider(provider.baseURL, provider.apiKey);
  } catch {
    return getClientForProvider(
      "https://api.openai.com/v1",
      "placeholder-key-until-configured"
    );
  }
}

export function resetClient(): void {
  clientPool.clear();
}

export const client = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const realClient = getClient();
    const val = (realClient as any)[prop];
    if (typeof val === "function") {
      return val.bind(realClient);
    }
    return val;
  },
});
