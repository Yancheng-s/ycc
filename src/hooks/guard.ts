import type { AgentHooks } from "../types.js";

export function createCliGuard(rl: {
  question: (query: string) => Promise<string>;
}): AgentHooks {
  return {
    beforeToolExecute: async (name, args) => {
      if (name === "run_command") {
        let cmd = "";
        if (typeof args.command === "string") {
          cmd = args.command;
        }
        const query = `\n⚠️ [安全确认] Agent 试图执行命令: [${cmd}]，是否允许？(y/n): `;
        const answer = await rl.question(query);
        const normalized = answer.trim().toLowerCase();
        return normalized === "y" || normalized === "yes";
      }
      return true;
    },
  };
}
