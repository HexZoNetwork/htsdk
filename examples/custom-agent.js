/**
 * Example custom agent built on htsdk (no Telegram wiring — bring your own).
 * Run: node examples/custom-agent.js
 * Env: HT_BASE_URL, HT_API_KEY, HT_MODEL
 * Non-commercial (HXZ License).
 */
"use strict";

const { createAgent } = require("../index.js");

async function main() {
  const agent = createAgent({
    baseURL: process.env.HT_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.HT_API_KEY || "sk-...",
    model: process.env.HT_MODEL || "gpt-4o-mini",
  });
  if ((process.env.HT_API_KEY || "").startsWith("sk-...") || !process.env.HT_API_KEY) {
    console.log("Set HT_BASE_URL + HT_API_KEY to run a live chat. Scaffold OK:");
    console.log(`  baseURL=${agent.baseURL} model=${agent.model}`);
    return;
  }
  const res = await agent.chat([{ role: "user", content: "Say OK in one word." }]);
  console.log("agent:", res.content);
}

main().catch((e) => {
  console.error("custom-agent failed:", e.message);
  process.exit(1);
});
