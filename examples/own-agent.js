/**
 * Minimal standalone Telegram agent built on htsdk.
 * This is the "modify HexTelegram into your own agent" starting point:
 * Telegram wiring (Telegraf) + htsdk chat + a small tool loop you extend.
 *
 * Run:
 *   HT_BOT_TOKEN=123:abc HT_BASE_URL=https://api.openai.com/v1 HT_API_KEY=sk-... node examples/own-agent.js
 * Without HT_BOT_TOKEN it only prints a scaffold check and exits.
 *
 * Non-commercial (HXZ License).
 */
"use strict";

const { createAgent, splitTG, commandArgs } = require("../index.js");

const TOKEN = process.env.HT_BOT_TOKEN || "";
const BASE_URL = process.env.HT_BASE_URL || "https://api.openai.com/v1";
const API_KEY = process.env.HT_API_KEY || "";
const MODEL = process.env.HT_MODEL || "gpt-4o-mini";

const TOOLS = [
  { type: "function", function: { name: "get_time", description: "Current UTC time.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "echo_text", description: "Echo text back.", parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } },
];

async function runLocalTool(name, args) {
  if (name === "get_time") return new Date().toISOString() + " (UTC)";
  if (name === "echo_text") return String((args || {}).text || "");
  return `unknown tool '${name}'`;
}

async function answer(agent, history, maxRounds = 4) {
  for (let round = 0; round < maxRounds; round++) {
    const res = await agent.chat(history, TOOLS);
    if (!res.toolCalls.length) return res.content || "(empty reply)";
    history.push({ role: "assistant", content: res.content || "", tool_calls: res.toolCalls });
    for (const tc of res.toolCalls) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
      let out = "";
      try { out = await runLocalTool(tc.function.name, args); }
      catch (e) { out = `tool error: ${String((e && e.message) || e)}`; }
      history.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: String(out).slice(0, 4000) });
    }
  }
  return "(stopped: too many tool rounds)";
}

async function main() {
  let Telegraf = null;
  try {
    Telegraf = require("telegraf").Telegraf;
  } catch {
    console.error("telegraf is not installed here. Run: npm install telegraf");
    process.exit(1);
  }
  if (!TOKEN || !API_KEY) {
    console.log("own-agent scaffold OK (set HT_BOT_TOKEN + HT_API_KEY for live mode).");
    console.log(`endpoint=${BASE_URL} model=${MODEL} tools=${TOOLS.map((t) => t.function.name).join(",")}`);
    return;
  }
  const agent = createAgent({ baseURL: BASE_URL, apiKey: API_KEY, model: MODEL });
  const bot = new Telegraf(TOKEN);
  const history = new Map();
  bot.start((ctx) => ctx.reply("Hi, I am your own agent. Send anything, or /new to reset."));
  bot.command("new", (ctx) => { history.delete(ctx.chat.id); ctx.reply("History cleared."); });
  bot.on("text", async (ctx) => {
    try {
      const parsed = commandArgs(ctx.message.text || "");
      if (parsed && ["start", "new"].includes(parsed.cmd)) return;
      if (!history.has(ctx.chat.id)) history.set(ctx.chat.id, []);
      const h = history.get(ctx.chat.id);
      h.push({ role: "user", content: ctx.message.text });
      while (h.length > 20) h.shift();
      const reply = await answer(agent, h);
      h.push({ role: "assistant", content: reply });
      for (const chunk of splitTG(reply)) {
        try {
          await ctx.reply(chunk.slice(0, 4000), { parse_mode: "Markdown" });
        } catch {
          await ctx.reply(chunk.slice(0, 4000));
        }
      }
    } catch (e) {
      try { await ctx.reply(`error: ${String((e && e.message) || e).slice(0, 300)}`); } catch {}
    }
  });
  await bot.launch();
  console.log("own-agent online. Press Ctrl+C to stop.");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((e) => {
  console.error("own-agent failed:", (e && e.message) || e);
  process.exit(1);
});
