import type { Tool } from "../types.js";

export const timeTool: Tool = {
  name: "get_current_time",
  description: "获取系统当前的真实日期和时间",
  execute: () => {
    const now = new Date();
    return now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  },
};
