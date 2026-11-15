import { createInterface } from "node:readline/promises";
import type OpenAI from "openai";
import { chat } from "./agent.js";
import { consoleLogger, createCliGuard } from "./hooks/index.js";
import { createWorkspace, saveSession } from "./workspace/index.js";
import { resetClient } from "./client.js";
import {
  ensureGlobalStorage,
  loadGlobalConfig,
  resolveAppConfig,
  saveGlobalConfig,
} from "./config.js";

export async function handleInit(
  rl: ReturnType<typeof createInterface>
): Promise<void> {
  const info = ensureGlobalStorage();
  const current = loadGlobalConfig();

  console.log("=== YCC 全局总工作空间初始化与配置 ===");
  console.log(`存储基准目录: ${info.homeDir}`);
  console.log(`配置文件路径: ${info.configPath}\n`);

  const currentKey = current.apiKey || "";
  const currentUrl = current.baseURL || "https://api.openai.com/v1";
  const currentModel = current.model || "gpt-4o";

  let keyPrompt = "请输入 API Key: ";
  if (currentKey) {
    keyPrompt = `请输入 API Key [当前: ${currentKey.slice(0, 6)}... / 直接回车保留]: `;
  }
  const inputKey = await rl.question(keyPrompt);

  const urlPrompt = `请输入 Base URL [当前: ${currentUrl} / 直接回车保留]: `;
  const inputUrl = await rl.question(urlPrompt);

  const modelPrompt = `请输入 Default Model [当前: ${currentModel} / 直接回车保留]: `;
  const inputModel = await rl.question(modelPrompt);

  let apiKey = currentKey;
  if (inputKey.trim()) {
    apiKey = inputKey.trim();
  }

  let baseURL = currentUrl;
  if (inputUrl.trim()) {
    baseURL = inputUrl.trim();
  }

  let model = currentModel;
  if (inputModel.trim()) {
    model = inputModel.trim();
  }

  saveGlobalConfig({
    apiKey,
    baseURL,
    model,
  });

  resetClient();

  console.log("\n✔ 全局配置已成功更新并覆盖保存！");
  let maskedKey = "(未设置)";
  if (apiKey) {
    maskedKey = apiKey.slice(0, 6) + "...";
  }
  console.log(`  - apiKey: ${maskedKey}`);
  console.log(`  - baseURL: ${baseURL}`);
  console.log(`  - model: ${model}\n`);
}

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "-v" || command === "--version") {
    console.log("ycc version 0.1.0");
    return;
  }

  if (command === "-h" || command === "--help") {
    console.log("用法: ycc [up|run|init] [options]\n");
    console.log("命令:");
    console.log("  up, run    启动当前工作空间进入多轮对话模式 (默认)");
    console.log("  init       交互式初始化并配置全局总工作空间 (~/.ycc)");
    console.log("  -v, --version  查看版本号");
    console.log("  -h, --help     查看帮助信息");
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (command === "init") {
      await handleInit(rl);
      console.log("🚀 初始化就绪！你可以在任意工程目录下执行 ycc up 开启 Agent。");
      return;
    }

    if (command === "up" || command === "run" || !command) {
      ensureGlobalStorage();
      let config = resolveAppConfig();

      if (!config.apiKey) {
        console.log("提示：未检测到有效 API Key，正在为您启动快速配置向导...\n");
        await handleInit(rl);
        config = resolveAppConfig();
        if (!config.apiKey) {
          console.error("错误：未能成功设置 API Key，无法启动 Agent。");
          return;
        }
        console.log("✔ 配置就绪，直接启动工作空间...\n");
      }

      const cliGuard = createCliGuard(rl);
      const workspace = createWorkspace({
        hooks: [consoleLogger, cliGuard],
      });
      const history: OpenAI.Chat.ChatCompletionMessageParam[] = [];
      console.log(`进入多轮对话模式，工作空间根目录: ${workspace.root}`);
      if (workspace.storageDir) {
        console.log(`持久化抽屉目录: ${workspace.storageDir}`);
      }
      console.log("输入 exit 退出。\n");

      while (true) {
        const input = await rl.question("你: ");
        if (input.trim() === "exit") {
          break;
        }
        if (!input.trim()) {
          continue;
        }
        try {
          const answer = await chat(input, history, workspace);
          console.log(`\nAI: ${answer}\n`);
          if (workspace.storageDir && history.length > 0) {
            await saveSession(workspace.storageDir, "latest", history);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`\n[请求错误] ${message}\n`);
        }
      }
    }
  } finally {
    rl.close();
  }
}
