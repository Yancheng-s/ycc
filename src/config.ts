import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { GlobalConfig, GlobalStorageInfo, ProviderConfig } from "./types.js";

export function getYccHome(): string {
  return path.join(os.homedir(), ".ycc");
}

export function ensureGlobalStorage(): GlobalStorageInfo {
  const homeDir = getYccHome();
  const workspacesDir = path.join(homeDir, "workspaces");
  const configPath = path.join(homeDir, "config.json");

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(workspacesDir, { recursive: true });

  let isFirstRun = false;
  if (!fs.existsSync(configPath)) {
    isFirstRun = true;
    const template: GlobalConfig = {
      current: "default",
      providers: {
        default: {
          apiKey: "",
          baseURL: "https://api.openai.com/v1",
          model: "gpt-4o",
        },
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(template, null, 2), "utf-8");
  }

  return {
    homeDir,
    configPath,
    workspacesDir,
    isFirstRun,
  };
}

export function loadGlobalConfig(): GlobalConfig {
  const configPath = path.join(getYccHome(), "config.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      return parsed as GlobalConfig;
    }
    return {};
  } catch {
    return {};
  }
}

export function normalizeBaseURL(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  let trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }
  trimmed = trimmed.replace(/\/chat\/completions\/?$/i, "");
  trimmed = trimmed.replace(/\/+$/, "");
  return trimmed;
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const home = getYccHome();
  fs.mkdirSync(home, { recursive: true });
  const configPath = path.join(home, "config.json");

  const cleanProviders: Record<string, ProviderConfig> = {};
  if (config.providers) {
    for (const [key, val] of Object.entries(config.providers)) {
      if (val && typeof val === "object") {
        let cleanUrl = normalizeBaseURL(val.baseURL);
        if (!cleanUrl) {
          cleanUrl = "https://api.openai.com/v1";
        }
        cleanProviders[key] = {
          apiKey: val.apiKey || "",
          baseURL: cleanUrl,
          model: val.model || "",
        };
      }
    }
  }

  let activeCurrent = config.current;
  if (!activeCurrent) {
    const keys = Object.keys(cleanProviders);
    if (keys.length > 0) {
      activeCurrent = keys[0];
    } else {
      activeCurrent = "default";
    }
  }

  const normalized: GlobalConfig = {
    current: activeCurrent,
    providers: cleanProviders,
  };

  fs.writeFileSync(configPath, JSON.stringify(normalized, null, 2), "utf-8");
}

export function resolveProvider(target?: string): {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
} {
  const config = loadGlobalConfig();
  let activeName = target;
  if (!activeName) {
    activeName = config.current;
  }
  if (!activeName && config.providers) {
    const keys = Object.keys(config.providers);
    if (keys.length > 0) {
      activeName = keys[0];
    }
  }

  if (!activeName) {
    throw new Error("缺少模型服务商配置：请运行 ycc init 配置大模型凭据");
  }

  if (!config.providers || !config.providers[activeName]) {
    throw new Error(`未找到名为 [${activeName}] 的模型服务商配置，请检查 ~/.ycc/config.json 或运行 ycc init`);
  }

  const provider = config.providers[activeName];
  let cleanUrl = normalizeBaseURL(provider.baseURL);
  if (!cleanUrl) {
    cleanUrl = "https://api.openai.com/v1";
  }

  return {
    name: activeName,
    apiKey: provider.apiKey || "",
    baseURL: cleanUrl,
    model: provider.model || "",
  };
}
