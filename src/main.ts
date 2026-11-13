import { runCli } from "./cli.js";

export { chat } from "./agent.js";
export { client } from "./client.js";
export type { Tool, ChatOptions } from "./types.js";

runCli().catch((err) => {
  console.error(err);
  process.exit(1);
});
