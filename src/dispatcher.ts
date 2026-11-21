import type OpenAI from "openai";
import type { WorkspaceHooks } from "./types.js";

export class HookDispatcher {
  private handlers: WorkspaceHooks[];

  constructor(hooks?: WorkspaceHooks | WorkspaceHooks[]) {
    if (!hooks) {
      this.handlers = [];
    } else if (Array.isArray(hooks)) {
      this.handlers = hooks;
    } else {
      this.handlers = [hooks];
    }
  }

  onLLMRequest(
    params: OpenAI.Chat.ChatCompletionCreateParamsStreaming
  ): void {
    for (const h of this.handlers) {
      if (h.onLLMRequest) {
        h.onLLMRequest(params);
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
    response: OpenAI.Chat.ChatCompletion
  ): void {
    for (const h of this.handlers) {
      if (h.onLLMResponse) {
        h.onLLMResponse(response);
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
