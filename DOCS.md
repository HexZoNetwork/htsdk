# htsdk - Documentation

> **What:** helpers to build things for **HexTelegram** (the Telegram AI bot by HexzoNetwork).
> **Why:** so anyone can extend the bot (new commands), build their own compatible agent,
> or add new login backends - without touching the bot's core files.
> **License:** non-commercial only (HXZ). See [LICENCE](./LICENCE).

## Contents

1. [Install](#1-install)
2. [What you can do](#2-what-you-can-do)
3. [Track A - Plugins (add bot commands)](#3-track-a--plugins-add-bot-commands)
4. [Track B - Custom agents](#4-track-b--custom-agents)
5. [Track C - Auth providers](#5-track-c--auth-providers)
6. [API reference](#6-api-reference)
7. [Limits & safety](#7-limits--safety)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Install

No npm publish needed:

```bash
npm install github:HexZoNetwork/htsdk
```

```js
const { definePlugin, createAgent } = require("htsdk");
```

After the first npm release, `npm install htsdk` works too. Requires **Node 18+**.
Zero dependencies.

Other ways to get the files:

```bash
npx degit HexZoNetwork/htsdk htsdk        # copy without git history
node -e "require('./index.js')"           # sanity check from the folder
```

---

## 2. What you can do

| Track | File | Result |
|---|---|---|
| **A. Plugin** | `plugin.js` + `index.js` | A `.js` file you send to the bot → new `/commands` for everyone |
| **B. Custom agent** | `index.js` | Your own bot/CLI that speaks the same chat protocol as HexTelegram |
| **C. Auth provider** | `auth-providers.js` | A new login backend (OAuth translator) the bot could adopt |

---

## 3. Track A - Plugins (add bot commands)

### Why

The bot ships with fixed commands (`/start`, `/model`, `/login`, …). Plugins let you
add your own (`/hello`, `/ping`, `/echo`, …) **without editing `bot.js`**.
Write a file → send it to the bot → reply `/plugin` → done.

### How (step by step)

**1. Copy the example and edit it:**

```bash
cp examples/hello-plugin.js my-plugin.js
```

**2. Describe your plugin:**

```js
module.exports = {
  name: "hello",
  version: "1.0.0",
  description: "Says hello.",

  commands: {
    hello: async (ctx, args, api) => {
      await ctx.reply("hi");
    },
  },
};
```

Or validate it with the SDK (throws on mistakes, before you ever send it):

```js
const { definePlugin } = require("htsdk");

module.exports = definePlugin({
  name: "hello",
  version: "1.0.0",
  description: "Says hello.",
  commands: {
    hello: async (ctx, args, api) => {
      await ctx.reply("hi");
    },
    echo: {
      description: "Echo back text",
      usage: "/echo <text>",
      handler: async (ctx, args, api) => {
        if (!String(args || "").trim()) {
          await ctx.reply("Usage: /echo <text>");
          return;
        }
        await ctx.reply(String(args).slice(0, 1000));
      },
    },
  },
  onLoad(api) { api.log("hello loaded"); },
  onUnload(api) {},
});
```

**3. Check it locally:**

```bash
node -e "require('htsdk').definePlugin(require('./my-plugin.js')); console.log('plugin valid')"
```

**4. Install it into the bot** (owner only) - send `my-plugin.js` as a document,
reply to it with:

```
/plugin
```

Custom id: `/plugin myname` (replying to the file). From a URL:

```
/plugin https://example.com/my-plugin.js myname
```

**5. Use and manage it:**

```
/hello world        ← your new command (any allowed user)
/pl ls              ← list plugins
/pl info hello      ← details
/pl reload          ← reload all after you edit + reinstall
/pl off hello       ← disable without deleting
/pl on hello        ← enable again
/pl del hello       ← delete + remove files
```

### Explanation - what the bot gives your code

Every command handler is called as `handler(ctx, args, api)`:

- **`ctx`** - the Telegraf context. `ctx.reply(text)`, `ctx.telegram.*` (full Bot API),
  `ctx.from` (sender), `ctx.chat`, `ctx.message`. If you know Telegraf, you know `ctx`.
- **`args`** - the text after the command. `/echo hi there` → `"hi there"`.
  Empty string when the user sends just `/echo`.
- **`api`** - bot services:
  - `api.bot` - the Telegraf instance (advanced use).
  - `api.config` - bot config (read-only habits: read values, don't rewrite secrets).
  - `api.runTool(name, args)` - call a bot tool (`shell_exec`, `file_read`, `web_fetch`, …).
  - `api.storage` - persistent notes: `get(id)` → `{content, updated} | null`,
    `list()` → `[{id, bytes, updated, preview}]`, `save(id, content)` → `true/false`.
  - `api.chat` - `chatStream(messages, tools, …)`, `currentProvider()`, `currentChatModel()`.
  - `api.log(...)` - log with a `[plugin]` prefix.
  - `api.pluginsDir` - where plugins live on disk.

`onLoad(api)` runs when the plugin loads (register timers, warm caches).
`onUnload(api)` runs before unload/reload/delete (clear timers, close handles).

### Examples

Each snippet below is one entry for your `commands: { … }` map:

**Ping (measure round-trip):**

```js
ping: async (ctx) => {
  const t0 = Date.now();
  const m = await ctx.reply("pong…");
  await ctx.telegram.editMessageText(m.chat.id, m.message_id, undefined, `pong (${Date.now() - t0}ms)`);
},
```

**Shell via bot tools (reuse, don't reimplement):**

```js
disk: async (ctx, args, api) => {
  const out = await api.runTool("shell_exec", { command: "df -h / | tail -1" }, ctx);
  await ctx.reply("```\n" + String(out).slice(0, 1000) + "\n```", { parse_mode: "Markdown" });
},
```

**Remember something (persistent storage):**

```js
note: async (ctx, args, api) => {
  const parts = String(args || "").trim().split(/\s+/);
  if (parts.length < 2) {
    const all = api.storage.list();
    await ctx.reply(all.length
      ? "Notes:\n" + all.map((e) => `• ${e.id}`).join("\n")
      : "No notes. Usage: /note <id> <text>");
    return;
  }
  const id = parts[0];
  const text = String(args).slice(id.length).trim();
  api.storage.save(id, text);
  await ctx.reply(`Saved note \`${id}\`. Read it back with /noteread ${id}`, { parse_mode: "Markdown" });
},
noteread: async (ctx, args, api) => {
  const v = api.storage.get(String(args || "").trim());
  await ctx.reply(v ? v.content.slice(0, 1000) : "No such note. See /note.");
},
```

### Command routing - how it works

When any `/command` arrives, the bot checks enabled plugins **before** its own handlers.
First plugin that owns the name runs; anything else falls through to built-ins.
That means:

- Two plugins can't own the same name - first loaded wins, so pick distinctive names.
- You **cannot** override built-ins (`/start`, `/model`, `/login`, `/logout`,
  `/plugin`, `/pl`, `/str`, …). The bot keeps those.

### Updating a plugin

Edit your file → send it again → reply `/plugin <same-id>` (overwrites) → `/pl reload`.
Or edit on the server and run `/pl reload` directly.

---

## 4. Track B - Custom agents

### Why

You like the bot's protocol (OpenAI-style `{model, messages, tools}` + tool-loop) but
want your own frontend (CLI, HTTP server, another chat network). `createAgent`
gives you the same call shape, so prompts/tools you design for HexTelegram port over.

### How

```js
const { createAgent } = require("htsdk");

const agent = createAgent({
  baseURL: "https://api.openai.com/v1",
  apiKey: process.env.HT_API_KEY,
  model: "gpt-4o-mini",
});

const res = await agent.chat([
  { role: "system", content: "You are concise." },
  { role: "user", content: "Summarize: HexTelegram in one line." },
]);

console.log(res.content);
console.log(res.toolCalls);
console.log(res.finishReason);
```

With tools (the model can ask to call them - **you** execute and reply):

```js
const res = await agent.chat(
  [{ role: "user", content: "What is 14*14?" }],
  [{ type: "function", function: {
    name: "calc",
    description: "Evaluate math",
    parameters: { type: "object", properties: { expression: { type: "string" } } },
  } }],
);
const followUp = await agent.chat([
  { role: "user", content: "What is 14*14?" },
  { role: "assistant", content: "", tool_calls: [{ id: res.toolCalls[0].id, type: "function", function: res.toolCalls[0].function }] },
  { role: "tool", tool_call_id: res.toolCalls[0].id, name: "calc", content: "14*14 = 196" },
]);
```

See `examples/custom-agent.js` - runnable scaffold (`HT_BASE_URL` / `HT_API_KEY` / `HT_MODEL`).

### Helpers

```js
const { splitTG, escapeMarkdown, commandArgs } = require("htsdk");

splitTG(longText);
escapeMarkdown(text);
commandArgs("/echo hi");
```

---

## 5. Track C - Auth providers

### Why

The bot can talk to AI three ways: API key, Google OAuth (Antigravity), ChatGPT OAuth.
A *provider* is the translator between OpenAI-style chat calls and some backend.
`defineProvider` is the skeleton for proposing a new one.

### How

```js
const { defineProvider } = require("htsdk/auth-providers.js");

module.exports = defineProvider({
  id: "my-gateway",
  label: "My Gateway",
  description: "What backend this talks to.",

  async authorize() {
    throw new Error("not implemented");
  },

  async exchange({ code, verifier }) {
    throw new Error("not implemented");
  },

  async refresh(account) {
    return account;
  },

  async chat({ token, model, messages, tools }) {
    throw new Error("not implemented");
  },
});
```

See `examples/antigravity-provider.js` for the annotated skeleton.
Reference implementation: the bot's own `auth.js` (Antigravity translation:
OpenAI messages → Gemini `contents`, schema cleaning, SSE unwrap, account rotation).
A provider only becomes usable once wired into the bot core - open it as a proposal
against the bot repo with this skeleton filled in.

---

## 6. API reference

### `definePlugin(def)`

Validates and returns a plugin module. Throws with a plain-English reason on misuse.

| Field | Required | Rules |
|---|---|---|
| `name` | no | String ≤64, shown in `/pl ls` |
| `version` | no | String ≤32, default `"1.0.0"` |
| `description` | no | String ≤500, shown in `/pl info` |
| `commands` | no | `{ name: fn \| { description?, usage?, handler } }` |
| `onLoad(api)` | no | Function, runs on load |
| `onUnload(api)` | no | Function, runs on unload/reload/delete |

Command names: `[A-Za-z0-9_]`, max 32, case-insensitive (`/Ping` → `ping`).
Handler signature: `async (ctx, args, api) => {}`.

### `createAgent({ baseURL, apiKey, model })`

Returns `{ baseURL, model, chat, splitTG, commandArgs }`.
`chat(messages, tools?, extra?)` → `{ content, toolCalls, finishReason, raw }`.
`extra`: `{ model?, temperature?, maxTokens?, signal? }` (abort via `AbortController`).

### `defineProvider(def)`

Requires `{ id, authorize, exchange, refresh, chat }` (all functions);
optional `{ label, description }`. `id`: `[A-Za-z0-9_-]`, max 32.

### Small helpers

| Helper | What |
|---|---|
| `splitTG(text, n=4000)` | Split for Telegram message limits |
| `escapeMarkdown(text)` | Escape `_ * ` [ ]` |
| `commandArgs(text)` | Parse `/cmd args` → `{cmd, arg}` or `null` |
| `validId(id)` / `validCmd(name)` | The exact checks the bot uses for ids/commands |

---

## 7. Limits & safety

- **Install is owner-only.** Plugins are arbitrary code - the bot trusts whoever
  installs them completely. Only the owner can `/plugin` or `/pl …`.
- **Running is not:** any allowed user can run an installed plugin's commands.
- **Single file:** `.js`/`.cjs`, ≤500KB. **Bundle:** `.zip`, ≤5MB, with `index.js`
  (or `main.js` / `plugin.js`) at the root.
- **Ids:** `[A-Za-z0-9_-]`, max 48. **Commands:** `[A-Za-z0-9_]`, max 32.
- On install the bot scans for risky patterns (env/secret reads, process spawn,
  network, destructive shell) and **shows** them - it doesn't block, so read the flags.
- Keep handlers fast; long work should reply progressively (progress message → edits),
  same as the bot core does. Always `await ctx.reply(...)` inside `try/catch` if the
  chat may be unavailable - a throwing plugin only fails its own command.
- Never log or send `api.config` secrets (tokens, keys). The core refuses such
  requests; your plugin should too.

## 8. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `definePlugin: bad command name` | Name has `-`/`.`/spaces → use letters, digits, `_` |
| `/plugin` says "Only .js/.zip" | You replied to a photo/text, not the **document** - send as file |
| `Zip has no index.js…` | Entry file must be at zip **root**, not in a subfolder |
| `Syntax error: …` | Run the file with `node --check my-plugin.js` first |
| Command does nothing | Name collides with a built-in or another plugin → rename; check `/pl ls` shows it ✅ enabled |
| `⚠️ Flags: …` on install | Informational risky-pattern hits - review, `/pl del <id>` if unsure |
| `require("htsdk")` fails | You copied files, not installed: `npm install github:HexZoNetwork/htsdk` or `require("./htsdk")` relatively |

---

*SDK version 1.0.0 · mirrors bot commands `/plugin`, `/pl`, `/login` · HXZ License - non-commercial.*
