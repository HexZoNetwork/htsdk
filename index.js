/**
 * htsdk - HexTelegram SDK (non-commercial, HXZ License).
 *
 * Build your own agent compatible with HexTelegram, or write plugins that add
 * commands to the bot. No dependencies.
 *
 *   const { definePlugin, testPlugin, createAgent, splitTG } = require("htsdk");
 *
 * Plugin contract (same as HexTelegram `plugins/`):
 *   module.exports = definePlugin({
 *     name: "hello",
 *     version: "1.0.0",
 *     description: "Says hello",
 *     commands: {
 *       hello: async (ctx, args, api) => { await ctx.reply("hi"); },
 *       echo: { description: "...", usage: "/echo <text>",
 *               handler: async (ctx, args, api) => {} },
 *     },
 *     onLoad(api) {}, onUnload(api) {},
 *   });
 *
 *   module.exports = definePlugin((api) => ({ name: "lazy", commands: { ... } }));
 *
 *   const r = await testPlugin("./my-plugin.js", "hello", "world");
 *   console.log(r.ok, r.replies);
 *
 * `ctx` is a Telegraf context. `args` is the text after the command.
 * `api` is { bot, config, runTool, storage, chat, log }.
 */

"use strict";

const path = require("path");

function validId(id) {
  return /^[A-Za-z0-9_-]{1,48}$/.test(String(id || ""));
}
function validCmd(name) {
  return /^[A-Za-z0-9_]{1,32}$/.test(String(name || ""));
}

function validatePluginObject(def) {
  if (!def || (typeof def !== "object" && typeof def !== "function")) throw new Error("definePlugin: def must be an object");
  const out = {
    name: String(def.name || "unnamed").slice(0, 64),
    version: String(def.version || "1.0.0").slice(0, 32),
    description: String(def.description || "").slice(0, 500),
    commands: {},
  };
  const cmds = def.commands || {};
  for (const [raw, val] of Object.entries(cmds)) {
    const name = String(raw || "").replace(/^\//, "").toLowerCase();
    if (!validCmd(name)) throw new Error(`definePlugin: bad command name '${raw}' (use [A-Za-z0-9_], max 32)`);
    if (typeof val === "function") out.commands[name] = val;
    else if (val && typeof val.handler === "function") {
      out.commands[name] = {
        description: String(val.description || ""),
        usage: String(val.usage || `/${name}`),
        handler: val.handler,
      };
    } else throw new Error(`definePlugin: command '${name}' needs a function or { handler }`);
  }
  if (def.onLoad !== undefined) {
    if (typeof def.onLoad !== "function") throw new Error("definePlugin: onLoad must be a function");
    out.onLoad = def.onLoad;
  }
  if (def.onUnload !== undefined) {
    if (typeof def.onUnload !== "function") throw new Error("definePlugin: onUnload must be a function");
    out.onUnload = def.onUnload;
  }
  return out;
}

function definePlugin(def) {
  if (typeof def === "function" && !def.commands) {
    const factory = def;
    return function definedPluginFactory(api) {
      return validatePluginObject(factory(api) || {});
    };
  }
  return validatePluginObject(def);
}

async function testPlugin(pluginDefOrPath, command, args = "") {
  let mod = pluginDefOrPath;
  if (typeof mod === "string") {
    const resolved = path.resolve(mod);
    delete require.cache[resolved];
    mod = require(resolved);
    if (mod && mod.__esModule && mod.default) mod = mod.default;
  }
  if (typeof mod === "function" && !mod.commands) mod = (await mod({ log() {} })) || {};
  const plugin = validatePluginObject(mod);
  const name = String(command || "").replace(/^\//, "").toLowerCase();
  const entry = plugin.commands[name];
  if (!entry) throw new Error(`testPlugin: unknown command '${command}' (have: ${Object.keys(plugin.commands).join(", ") || "none"})`);
  const handler = typeof entry === "function" ? entry : entry.handler;
  const replies = [];
  const edits = [];
  const fakeCtx = {
    from: { id: 1, first_name: "Tester", username: "tester" },
    chat: { id: 1, type: "private" },
    message: { message_id: 1, text: `/${name}${args ? " " + args : ""}` },
    reply: async (text) => { replies.push(String(text)); return { chat: { id: 1 }, message_id: replies.length }; },
    telegram: {
      editMessageText: async (chatId, messageId, _unused, text) => { edits.push(String(text)); return true; },
      sendMessage: async (_chatId, text) => { replies.push(String(text)); return { message_id: replies.length }; },
    },
  };
  const api = {
    bot: null,
    config: {},
    runTool: async () => "(test stub: no live tools)",
    storage: { get: () => null, list: () => [], save: () => false },
    chat: null,
    log() {},
    pluginsDir: "",
  };
  try {
    await handler(fakeCtx, String(args || ""), api);
    return { ok: true, replies, edits };
  } catch (e) {
    return { ok: false, replies, edits, error: String((e && e.message) || e) };
  }
}

function splitTG(text, n = 4000) {
  const out = [];
  let s = String(text || "");
  while (s.length > n) {
    let cut = s.lastIndexOf("\n", n);
    if (cut < n * 0.5) cut = n;
    out.push(s.slice(0, cut));
    s = s.slice(cut);
  }
  out.push(s);
  return out.filter((x) => x.length);
}

function escapeMarkdown(text) {
  return String(text || "").replace(/([_*`\[\]])/g, "\\$1");
}

function commandArgs(text) {
  const m = String(text || "").match(/^\/(\w+)(@[\w_]+)?(\s+([\s\S]*))?$/);
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), arg: (m[4] || "").trim() };
}

/**
 * Minimal agent scaffold compatible with HexTelegram tool-calling shape.
 * This does NOT include Telegram wiring - bring your own Telegraf/bot.
 * It gives you the message helpers + OpenAI-compatible chat caller so your
 * custom agent speaks the same protocol (and can reuse auth-providers).
 *
 *   const agent = createAgent({ baseURL, apiKey, model });
 *   const res = await agent.chat([{ role: "user", content: "hi" }]);
 */
function createAgent(opts = {}) {
  const baseURL = String(opts.baseURL || "").replace(/\/$/, "");
  const apiKey = String(opts.apiKey || "");
  const model = String(opts.model || "gpt-4o-mini");
  if (!baseURL) throw new Error("createAgent: baseURL required");
  if (!apiKey) throw new Error("createAgent: apiKey required");

  async function chat(messages, tools, extra = {}) {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: extra.model || model,
        messages,
        temperature: extra.temperature ?? 0.7,
        max_tokens: extra.maxTokens ?? 2048,
        stream: false,
        ...(tools && tools.length ? { tools } : {}),
      }),
      signal: extra.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`chat ${res.status}: ${t.slice(0, 300)}`);
    }
    const j = await res.json().catch(() => ({}));
    const msg = (j.choices && j.choices[0] && j.choices[0].message) || {};
    return {
      content: msg.content || "",
      toolCalls: (msg.tool_calls || []).map((t, i) => ({
        id: t.id || `call_${i}`,
        type: "function",
        function: { name: (t.function && t.function.name) || "", arguments: (t.function && t.function.arguments) || "{}" },
      })),
      finishReason: (j.choices && j.choices[0] && j.choices[0].finish_reason) || null,
      raw: j,
    };
  }

  return { baseURL, model, chat, splitTG, commandArgs };
}

module.exports = { definePlugin, testPlugin, createAgent, splitTG, escapeMarkdown, commandArgs, validId, validCmd };
