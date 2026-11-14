import { describe, it, expect, vi } from "vitest";
import { createCliGuard } from "../src/hooks/guard.js";

describe("createCliGuard", () => {
  it("执行 run_command 时向用户提问并允许 y 确认放行", async () => {
    const questionMock = vi.fn().mockResolvedValue("y");
    const guard = createCliGuard({ question: questionMock });

    if (!guard.beforeToolExecute) {
      throw new Error("beforeToolExecute 未定义");
    }

    const result = await guard.beforeToolExecute("run_command", {
      command: "dir",
    });

    expect(result).toBe(true);
    expect(questionMock).toHaveBeenCalledWith(
      expect.stringContaining("Agent 试图执行命令: [dir]")
    );
  });

  it("执行 run_command 时用户输入 n 则拦截否决", async () => {
    const questionMock = vi.fn().mockResolvedValue("n");
    const guard = createCliGuard({ question: questionMock });

    if (!guard.beforeToolExecute) {
      throw new Error("beforeToolExecute 未定义");
    }

    const result = await guard.beforeToolExecute("run_command", {
      command: "rm -rf /",
    });

    expect(result).toBe(false);
  });

  it("执行非危险工具时不触发用户提问并直接放行", async () => {
    const questionMock = vi.fn();
    const guard = createCliGuard({ question: questionMock });

    if (!guard.beforeToolExecute) {
      throw new Error("beforeToolExecute 未定义");
    }

    const result = await guard.beforeToolExecute("get_current_time", {});

    expect(result).toBe(true);
    expect(questionMock).not.toHaveBeenCalled();
  });
});
