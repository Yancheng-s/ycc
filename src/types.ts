import type OpenAI from "openai";

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string> | string;
}

export interface WorkspaceHooks {
  onLLMRequest?: (
    params: OpenAI.Chat.ChatCompletionCreateParamsStreaming
  ) => void;
  onStreamChunk?: (chunk: OpenAI.Chat.ChatCompletionChunk) => void;
  onLLMResponse?: (response: OpenAI.Chat.ChatCompletion) => void;
  beforeToolExecute?: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<boolean> | boolean;
  onToolExecute?: (
    name: string,
    args: Record<string, unknown>,
    result: string,
    id: string
  ) => void;
}

export interface Workspace {
  root: string;
  storageDir?: string;
  tools: Tool[];
  systemPrompt: string;
  hooks?: WorkspaceHooks | WorkspaceHooks[];
  model?: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface GlobalConfig {
  current?: string;
  providers?: Record<string, ProviderConfig>;
}

export interface GlobalStorageInfo {
  homeDir: string;
  configPath: string;
  workspacesDir: string;
  isFirstRun: boolean;
}

export interface WorkspaceStorageInfo {
  storageDir: string;
  metaPath: string;
  sessionsDir: string;
  scratchDir: string;
}
