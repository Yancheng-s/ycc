import OpenAI from "openai";
import { normalizeBaseURL, resolveAppConfig } from "./storage.js";

let instance: OpenAI | undefined;

export function getClient(): OpenAI {
  if (instance) {
    return instance;
  }
  const config = resolveAppConfig();
  let apiKey = config.apiKey;
  if (!apiKey) {
    apiKey = "placeholder-key-until-configured";
  }
  instance = new OpenAI({
    baseURL: normalizeBaseURL(config.baseURL),
    apiKey,
  });
  return instance;
}

export function resetClient(): void {
  instance = undefined;
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
