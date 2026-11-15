import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureGlobalStorage,
  getYccHome,
  loadGlobalConfig,
  normalizeBaseURL,
  resolveAppConfig,
  saveGlobalConfig,
} from "../src/config.js";
import {
  ensureWorkspaceStorage,
  getProjectFingerprint,
  getWorkspaceStorageDir,
  listSessions,
  loadSession,
  saveSession,
} from "../src/workspace/storage.js";

describe("storage", () => {
  let tempHome: string;
  let homedirSpy: any;

  beforeEach(async () => {
    tempHome = path.join(os.tmpdir(), `ycc_test_home_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempHome, { recursive: true });
    homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(tempHome);
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fs.rm(tempHome, { recursive: true, force: true });
  });

  it("getYccHome 正确返回系统用户家目录下的 .ycc 路径", () => {
    expect(getYccHome()).toBe(path.join(tempHome, ".ycc"));
  });

  it("getProjectFingerprint 生成稳定且大小写不敏感的工程指纹", () => {
    const p1 = "c:/Users/Test/MyProject";
    const p2 = "C:/users/test/myproject";
    const f1 = getProjectFingerprint(p1);
    const f2 = getProjectFingerprint(p2);

    expect(f1.hash).toBe(f2.hash);
    expect(f1.id).toContain(f1.hash);
    expect(typeof f1.slug).toBe("string");
  });

  it("getWorkspaceStorageDir 指向 ~/.ycc/workspaces/<id>", () => {
    const dir = getWorkspaceStorageDir("c:/test_proj");
    expect(dir.startsWith(tempHome)).toBe(true);
    expect(dir).toContain("workspaces");
  });

  it("ensureGlobalStorage 预检并创建全局目录与空白模板", async () => {
    const info = ensureGlobalStorage();
    expect(info.isFirstRun).toBe(true);
    expect(info.homeDir).toBe(path.resolve(path.join(tempHome, ".ycc")));
    expect(info.configPath).toBe(path.join(tempHome, ".ycc", "config.json"));

    const raw = await fs.readFile(info.configPath, "utf-8");
    const cfg = JSON.parse(raw);
    expect(cfg.apiKey).toBe("");
    expect(cfg.baseURL).toBe("https://api.openai.com/v1");

    const info2 = ensureGlobalStorage();
    expect(info2.isFirstRun).toBe(false);
  });

  it("ensureWorkspaceStorage 创建必要目录与 meta.json", async () => {
    const projRoot = path.join(tempHome, "my_demo_proj");
    await fs.mkdir(projRoot, { recursive: true });

    const info = ensureWorkspaceStorage(projRoot);
    expect(info.storageDir).toBeDefined();

    const metaRaw = await fs.readFile(info.metaPath, "utf-8");
    const meta = JSON.parse(metaRaw);
    expect(meta.root).toBe(path.resolve(projRoot));
    expect(meta.createdAt).toBeDefined();
    expect(meta.lastAccessedAt).toBeDefined();

    const info2 = ensureWorkspaceStorage(projRoot);
    const metaRaw2 = await fs.readFile(info2.metaPath, "utf-8");
    const meta2 = JSON.parse(metaRaw2);
    expect(meta2.createdAt).toBe(meta.createdAt);
  });

  it("saveSession, loadSession 与 listSessions 完整生命周期", async () => {
    const projRoot = path.join(tempHome, "session_proj");
    const info = ensureWorkspaceStorage(projRoot);

    const history: any[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ];

    const savedPath = await saveSession(info.storageDir, "test_session", history);
    expect(savedPath.endsWith("test_session.json")).toBe(true);

    const loaded = await loadSession(info.storageDir, "test_session");
    expect(loaded).toEqual(history);

    const notFound = await loadSession(info.storageDir, "none_existent");
    expect(notFound).toBeNull();

    await saveSession(info.storageDir, "another_session", []);
    const sessions = await listSessions(info.storageDir);
    expect(sessions).toEqual(["another_session", "test_session"]);
  });

  it("loadGlobalConfig 与 saveGlobalConfig 读写全局配置", () => {
    expect(loadGlobalConfig()).toEqual({});

    const config = {
      apiKey: "test_key",
      baseURL: "https://api.test.com",
      model: "test_model",
    };
    saveGlobalConfig(config);
    expect(loadGlobalConfig()).toEqual(config);
  });

  it("normalizeBaseURL 自动过滤 /chat/completions 与末尾斜杠", () => {
    expect(normalizeBaseURL("https://api.test.com/v1/chat/completions")).toBe(
      "https://api.test.com/v1"
    );
    expect(normalizeBaseURL("https://api.test.com/v1/chat/completions/")).toBe(
      "https://api.test.com/v1"
    );
    expect(normalizeBaseURL("https://api.test.com/v1///")).toBe(
      "https://api.test.com/v1"
    );
    expect(normalizeBaseURL("")).toBeUndefined();
    expect(normalizeBaseURL(undefined)).toBeUndefined();
  });

  it("resolveAppConfig 全面走全局配置文件，忽略 process.env", () => {
    saveGlobalConfig({
      apiKey: "global_key",
      baseURL: "https://global.test.com",
      model: "global_model",
    });

    const origKey = process.env.OPENAI_API_KEY;
    const origUrl = process.env.OPENAI_BASE_URL;
    const origModel = process.env.OPENAI_MODEL;

    process.env.OPENAI_API_KEY = "env_override_key";
    process.env.OPENAI_BASE_URL = "https://env.override.com";
    process.env.OPENAI_MODEL = "env_override_model";

    try {
      const resolved = resolveAppConfig();
      expect(resolved.apiKey).toBe("global_key");
      expect(resolved.baseURL).toBe("https://global.test.com");
      expect(resolved.model).toBe("global_model");
    } finally {
      if (origKey !== undefined) {
        process.env.OPENAI_API_KEY = origKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
      if (origUrl !== undefined) {
        process.env.OPENAI_BASE_URL = origUrl;
      } else {
        delete process.env.OPENAI_BASE_URL;
      }
      if (origModel !== undefined) {
        process.env.OPENAI_MODEL = origModel;
      } else {
        delete process.env.OPENAI_MODEL;
      }
    }
  });
});
