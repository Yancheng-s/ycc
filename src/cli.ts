import { createInterface } from "node:readline/promises";
import type OpenAI from "openai";
import { chat } from "./agent.js";
import { consoleLogger, createCliGuard } from "./hooks/index.js";
import { createWorkspace, saveSession } from "./workspace/index.js";
import { resetClient } from "./client.js";
import {
  ensureGlobalStorage,
  loadGlobalConfig,
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

  const currentProviderName = current.current || "default";
  let existingProvider = {
    apiKey: "",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o",
  };
  if (current.providers && current.providers[currentProviderName]) {
    existingProvider = current.providers[currentProviderName];
  }

  const namePrompt = `请输入模型服务商标识 [当前: ${currentProviderName} / 直接回车保留]: `;
  const inputName = await rl.question(namePrompt);
  let providerName = currentProviderName;
  if (inputName.trim()) {
    providerName = inputName.trim();
  }

  let existingTarget = existingProvider;
  if (current.providers && current.providers[providerName]) {
    existingTarget = current.providers[providerName];
  }

  const currentKey = existingTarget.apiKey || "";
  const currentUrl = existingTarget.baseURL || "https://api.openai.com/v1";
  const currentModel = existingTarget.model || "gpt-4o";

  let keyPrompt = "请输入 API Key: ";
  if (currentKey) {
    keyPrompt = `请输入 API Key [当前: ${currentKey.slice(0, 6)}... / 直接回车保留]: `;
  }
  const inputKey = await rl.question(keyPrompt);

  const urlPrompt = `请输入 Base URL [当前: ${currentUrl} / 直接回车保留]: `;
  const inputUrl = await rl.question(urlPrompt);

  const modelPrompt = `请输入 Model ID [当前: ${currentModel} / 直接回车保留]: `;
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

  const updatedProviders = current.providers ? { ...current.providers } : {};
  updatedProviders[providerName] = {
    apiKey,
    baseURL,
    model,
  };

  saveGlobalConfig({
    current: providerName,
    providers: updatedProviders,
  });

  resetClient();

  console.log(`\n✔ 服务商 [${providerName}] 配置已成功更新并保存至 ~/.ycc/config.json！`);
  let maskedKey = "(未设置)";
  if (apiKey) {
    maskedKey = apiKey.slice(0, 6) + "...";
  }
  console.log(`  - 服务商: ${providerName}`);
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
    console.log("  init       交互式初始化并配置全局模型服务商 (~/.ycc)");
    console.log("选项:");
    console.log("  -m, --model <name>  单次临时指定使用的模型或服务商");
    console.log("  -v, --version       查看版本号");
    console.log("  -h, --help          查看帮助信息");
    return;
  }

  let requestedModel: string | undefined = undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" || args[i] === "-m") {
      if (args[i + 1]) {
        requestedModel = args[i + 1];
        i++;
      }
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (command === "init") {
      await handleInit(rl);
      console.log("🚀 初始化就绪！你可以在任意工程目录下执行 ycc up 开启 Agent。");
      return;
    }

    if (command === "up" || command === "run" || !command || requestedModel) {
      ensureGlobalStorage();
      let currentConfig = loadGlobalConfig();
      let hasValidKey = false;
      const activeName = currentConfig.current || "default";
      if (currentConfig.providers && currentConfig.providers[activeName]) {
        if (currentConfig.providers[activeName].apiKey) {
          hasValidKey = true;
        }
      }

      if (!hasValidKey) {
        console.log("提示：未检测到有效 API Key，正在为您启动快速配置向导...\n");
        await handleInit(rl);
        currentConfig = loadGlobalConfig();
        const recheckName = currentConfig.current || "default";
        if (
          !currentConfig.providers ||
          !currentConfig.providers[recheckName] ||
          !currentConfig.providers[recheckName].apiKey
        ) {
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
      const effectiveProviderName = requestedModel || currentConfig.current || "default";
      console.log(`进入多轮对话模式，工作空间根目录: ${workspace.root} (模型服务商: ${effectiveProviderName})`);
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
          const answer = await chat(input, history, workspace, requestedModel);
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
