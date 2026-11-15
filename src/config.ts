import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { GlobalConfig, GlobalStorageInfo } from "./types.js";

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
      apiKey: "",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4o",
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
  const normalizedConfig: GlobalConfig = {
    apiKey: config.apiKey,
    baseURL: normalizeBaseURL(config.baseURL),
    model: config.model,
  };
  fs.writeFileSync(configPath, JSON.stringify(normalizedConfig, null, 2), "utf-8");
}

export function resolveAppConfig(): GlobalConfig {
  const globalConfig = loadGlobalConfig();
  return {
    apiKey: globalConfig.apiKey,
    baseURL: normalizeBaseURL(globalConfig.baseURL),
    model: globalConfig.model,
  };
}
