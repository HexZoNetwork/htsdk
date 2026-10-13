# PLUGIN BOOK - write HexTelegram plugins with htsdk

Read this file when you (human or model) create, edit, or fix a plugin.
Companion: [DOCS.md](./DOCS.md) (long guide), [README.md](./README.md) (start here).
License: non-commercial only, see [LICENCE](./LICENCE).

## 1. File shape

One CommonJS file. Three accepted exports:

```js
module.exports = { name: "mine", commands: { hi: async (ctx) => { await ctx.reply("hi"); } } };
```

```js
module.exports = (api) => ({ name: "mine", commands: { hi: async (ctx) => { await ctx.reply("hi"); } } });
```

```js
const { definePlugin } = require("htsdk");
module.exports = definePlugin({ name: "mine", commands: {} });
```

Top-level fields: `name` (≤64), `version` (≤32), `description` (≤500),
`commands`, `tools`, `hooks`, `onLoad(api)`, `onUnload(api)`.
Zip bundles: same shape in `index.js` (or `main.js`, `plugin.js`) at zip root.

## 2. commands - humans call these

```js
commands: {
  hi: async (ctx, args, api) => { await ctx.reply("hi " + args); },
  echo: {
    description: "Echo back text",
    usage: "/echo <text>",
    handler: async (ctx, args, api) => { await ctx.reply(String(args).slice(0, 1000)); },
  },
},
```

Name rules: `[A-Za-z0-9_]`, max 32, case-insensitive, leading `/` stripped.
Dispatch: bot checks plugins before built-ins, first owner wins.
Reserved (never overridden): `start`, `model`, `login`, `logout`, `plugin`, `pl`,
`str`, `new`, `id`, `apis`, `talk`, and the rest of the core list.
A direct call runs code only - no model involved unless the handler calls `api.ask`.

## 3. tools - the agent calls these

```js
tools: {
  shout_text: {
    description: "Uppercase text",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    handler: async (args, ctx, api) => String((args || {}).text || "").toUpperCase().slice(0, 500),
  },
},
```

Name rules: `[A-Za-z0-9_-]`, max 32. Registered as `<pluginId>__<tool>`,
full name must stay ≤64 chars or the loader skips it with a log warning.
Handler receives the parsed args object, returns string or object.
Runs on every provider (apikey, Antigravity, ChatGPT) next to built-ins.
The model picks when to call - validate args, keep side effects careful.

## 4. hooks - reshape input, response, flow

```js
hooks: {
  input: async (text, ctx, api) => text,
  output: async (text, ctx, api) => text,
  beforeTool: async (name, args, ctx, api) => null,
  afterTool: async (name, args, result, ctx, api) => result,
},
```

Each kind takes one function or an array. Contract table:

| Hook | In | Out |
|---|---|---|
| `input` | user text before history and model | new text, `null` to keep, throw to block (message shown) |
| `output` | final answer before history and delivery | new text, `null` to keep (throw keeps original + logs) |
| `beforeTool` | `(name, args)` before any tool runs | `{ args }` to rewrite, `{ block: "why" }` or `"why"` to veto, `null` to allow, throw vetoes |
| `afterTool` | `(name, args, result)` after any tool runs | new result string, `null` to keep (throw keeps original) |

Hooks chain across plugins in load order. `input` covers captioned media text parts,
images pass through untouched. Slash-command dispatch skips `input`/`output`.
Disable or delete unregisters everything immediately.

## 5. api object

| Field | Shape |
|---|---|
| `bot` | Telegraf instance (advanced use) |
| `config` | bot config (read values, never rewrite secrets) |
| `runTool(name, args, ctx?)` | call a bot tool, returns text |
| `storage` | `get(id)`, `list()`, `save(id, content)` |
| `chat` | `chatStream(messages, tools, …)`, `currentProvider()`, `currentChatModel()` |
| `ask(text, ctx)` | full agent turn in current chat (think + tools + stream), truthy when delivered, absent on older bots |
| `log(...)` | log with `[plugin]` prefix |
| `pluginsDir` | plugin directory on disk |

Agent-backed command pattern (think instead of hardcoded logic):

```js
scan: {
  description: "Let the agent scan a URL",
  usage: "/scan <https://...>",
  handler: async (ctx, args, api) => {
    const u = String(args || "").trim().split(/\s+/)[0];
    if (!/^https?:\/\//i.test(u)) { await ctx.reply("Usage: /scan <https://...>"); return; }
    if (api && typeof api.ask === "function") {
      await api.ask("Security-scan this URL like an analyst and report concisely: " + u, ctx);
      return;
    }
    const out = await api.runTool("web_check", { url: u }, ctx);
    await ctx.reply(String(out).slice(0, 3000));
  },
},
```

## 6. Limits

Single file `.js`/`.cjs` ≤500KB. Zip ≤5MB. Id `[A-Za-z0-9_-]` max 48.
Only the owner installs or manages (`/plugin`, `/pl …`). Any allowed user runs
installed commands. Install scans for risky patterns (env, secrets, spawn,
network, destructive shell) and shows flags - read them, it does not block.
Keep replies ≤4000 chars per message (`splitTG` helps). Keep handlers fast.

## 7. Local workflow (no live bot)

```bash
node cli.js new mymod
node cli.js check mymod.js
node cli.js test mymod.js hello world
node cli.js tool mymod.js shout_text '{"text":"hey"}'
node cli.js hook mymod.js beforeTool '["shell_exec", {"command":"ls"}]'
```

Or in code: `definePlugin`, `testPlugin`, `testTool`, `testHook` from `htsdk`.
Ship: send the file to the bot, reply `/plugin`, manage with
`/pl ls|info|reload|on|off|del`.

## 8. Anti-patterns

Long synchronous loops (block the bot, use async chunks).
Secrets or tokens inside the plugin (use none, read none).
Raw `fetch`/`exec` when `api.runTool` covers it (uniform guards + logging).
Swallowing errors silently (reply the failure briefly so the user sees it).
Two plugins owning one command name (first loaded wins, renames are cheap).
