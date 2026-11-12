import { describe, it, expect } from "vitest";
import { timeTool, runCommandTool, defaultTools } from "../src/tools.js";

describe("timeTool", () => {
  it("正确返回包含年份的格式化时间字符串", async () => {
    const result = await timeTool.execute({});
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    const currentYear = String(new Date().getFullYear());
    expect(result).toContain(currentYear);
  });
});

describe("runCommandTool", () => {
  it("成功执行命令行指令并返回输出", async () => {
    const result = await runCommandTool.execute({
      command: "node -e \"process.stdout.write('test-output')\"",
    });
    expect(result).toBe("test-output");
  });

  it("当 command 为空或类型错误时返回格式错误提示", async () => {
    const resultEmpty = await runCommandTool.execute({ command: "" });
    const resultType = await runCommandTool.execute({});

    expect(resultEmpty).toBe("Error: command 参数必须是非空字符串");
    expect(resultType).toBe("Error: command 参数必须是非空字符串");
  });

  it("当命令执行失败时捕获异常并返回错误信息", async () => {
    const result = await runCommandTool.execute({
      command: "node -e \"process.exit(1)\"",
    });
    expect(result).toContain("执行出错");
  });

  it("当输出超过 2000 字符时自动执行截断", async () => {
    const result = await runCommandTool.execute({
      command: "node -e \"process.stdout.write('A'.repeat(2500))\"",
    });
    expect(result.length).toBeLessThan(2500);
    expect(result).toContain("...[输出过长已截断]");
  });
});

describe("defaultTools", () => {
  it("默认工具列表导出完整", () => {
    expect(defaultTools.length).toBe(2);
    expect(defaultTools.map((t) => t.name)).toEqual([
      "get_current_time",
      "run_command",
    ]);
  });
});
