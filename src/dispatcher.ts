import type OpenAI from "openai";
import type { AgentHooks } from "./types.js";

export class HookDispatcher {
  private handlers: AgentHooks[];

  constructor(hooks?: AgentHooks | AgentHooks[]) {
    if (!hooks) {
      this.handlers = [];
    } else if (Array.isArray(hooks)) {
      this.handlers = hooks;
    } else {
      this.handlers = [hooks];
    }
  }

  onLLMRequest(
    turn: number,
    params: OpenAI.Chat.ChatCompletionCreateParamsStreaming
  ): void {
    for (const h of this.handlers) {
      if (h.onLLMRequest) {
        h.onLLMRequest(turn, params);
      }
    }
  }

  onStreamChunk(chunk: OpenAI.Chat.ChatCompletionChunk): void {
    for (const h of this.handlers) {
      if (h.onStreamChunk) {
        h.onStreamChunk(chunk);
      }
    }
  }

  onLLMResponse(
    turn: number,
    response: OpenAI.Chat.ChatCompletion
  ): void {
    for (const h of this.handlers) {
      if (h.onLLMResponse) {
        h.onLLMResponse(turn, response);
      }
    }
  }

  async beforeToolExecute(
    name: string,
    args: Record<string, unknown>
  ): Promise<boolean> {
    for (const h of this.handlers) {
      if (h.beforeToolExecute) {
        const allowed = await h.beforeToolExecute(name, args);
        if (!allowed) {
          return false;
        }
      }
    }
    return true;
  }

  onToolExecute(
    name: string,
    args: Record<string, unknown>,
    result: string,
    id: string
  ): void {
    for (const h of this.handlers) {
      if (h.onToolExecute) {
        h.onToolExecute(name, args, result, id);
      }
    }
  }
}
