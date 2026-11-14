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
    params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
  ): void {
    for (const h of this.handlers) {
      if (h.onLLMRequest) {
        h.onLLMRequest(turn, params);
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
