import type OpenAI from "openai";

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string> | string;
}

export interface AgentHooks {
  onLLMRequest?: (
    turn: number,
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  ) => void;
  onLLMResponse?: (turn: number, response: OpenAI.Chat.ChatCompletion) => void;
  onToolExecute?: (
    name: string,
    args: Record<string, unknown>,
    result: string,
    id: string
  ) => void;
}

export interface ChatOptions {
  tools?: Tool[];
  maxTurns?: number;
  hooks?: AgentHooks;
}
