import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type OpenAI from "openai";
import { getYccHome } from "../config.js";
import type { WorkspaceStorageInfo } from "../types.js";

export function getProjectFingerprint(projectPath: string): {
  slug: string;
  hash: string;
  id: string;
} {
  const resolved = path.resolve(projectPath);
  const normalizedForHash = resolved.toLowerCase();
  const hash = crypto
    .createHash("sha256")
    .update(normalizedForHash)
    .digest("hex")
    .slice(0, 8);
  const rawBase = path.basename(resolved);
  let baseName = "root";
  if (rawBase && rawBase.trim()) {
    baseName = rawBase.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  }
  const id = `${baseName}-${hash}`;
  return {
    slug: baseName,
    hash,
    id,
  };
}

export function getWorkspaceStorageDir(projectPath: string): string {
  const { id } = getProjectFingerprint(projectPath);
  return path.join(getYccHome(), "workspaces", id);
}

export function ensureWorkspaceStorage(projectPath: string): WorkspaceStorageInfo {
  const resolvedRoot = path.resolve(projectPath);
  const storageDir = getWorkspaceStorageDir(resolvedRoot);
  const sessionsDir = path.join(storageDir, "sessions");
  const scratchDir = path.join(storageDir, "scratch");
  const metaPath = path.join(storageDir, "meta.json");

  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(scratchDir, { recursive: true });

  const now = new Date().toISOString();
  let createdAt = now;

  if (fs.existsSync(metaPath)) {
    try {
      const content = fs.readFileSync(metaPath, "utf-8");
      const existing = JSON.parse(content);
      if (existing && existing.createdAt) {
        createdAt = existing.createdAt;
      }
    } catch {
      createdAt = now;
    }
  }

  const metaData = {
    root: resolvedRoot,
    createdAt,
    lastAccessedAt: now,
  };

  fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2), "utf-8");

  return {
    storageDir,
    metaPath,
    sessionsDir,
    scratchDir,
  };
}

export async function saveSession(
  storageDir: string,
  sessionId: string,
  history: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<string> {
  const sessionsDir = path.join(storageDir, "sessions");
  await fsPromises.mkdir(sessionsDir, { recursive: true });
  const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
  const data = {
    sessionId,
    updatedAt: new Date().toISOString(),
    messages: history,
  };
  await fsPromises.writeFile(sessionPath, JSON.stringify(data, null, 2), "utf-8");
  return sessionPath;
}

export async function loadSession(
  storageDir: string,
  sessionId: string
): Promise<OpenAI.Chat.ChatCompletionMessageParam[] | null> {
  const sessionPath = path.join(storageDir, "sessions", `${sessionId}.json`);
  if (!fs.existsSync(sessionPath)) {
    return null;
  }
  try {
    const raw = await fsPromises.readFile(sessionPath, "utf-8");
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.messages)) {
      return data.messages;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listSessions(storageDir: string): Promise<string[]> {
  const sessionsDir = path.join(storageDir, "sessions");
  if (!fs.existsSync(sessionsDir)) {
    return [];
  }
  try {
    const entries = await fsPromises.readdir(sessionsDir, { withFileTypes: true });
    const result: string[] = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        result.push(entry.name.slice(0, -5));
      }
    }
    return result.sort();
  } catch {
    return [];
  }
}
