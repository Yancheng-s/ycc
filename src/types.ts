
export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string> | string;
}

export interface ChatOptions {
  tools?: Tool[];
  maxTurns?: number;
  verbose?: boolean;
}

