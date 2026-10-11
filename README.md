<div align="center">
  <h1>htsdk — HexTelegram SDK</h1>
  <p>Build custom agents + plugins for <b>HexTelegram</b> by <b>HexzoNetwork</b></p>
</div>

> written permission. See [LICENCE](./LICENCE).

## What is this?

`htsdk` is the public SDK for **HexTelegram (HTG)**

* ✏️ **Build plugins** that add commands to the bot (`/plugin` + `/pl`).
* 🤖 **Build your own agent** speaking the same OpenAI-compatible protocol.
* 🔐 **Define auth providers** add your costum provinder

Require Node 18+.

## Layout

```
htsdk/
├── index.js            ← definePlugin, createAgent, splitTG, commandArgs
├── plugin.js           ← plugin-only re-exports
├── auth-providers.js   ← defineProvider
├── examples/
│   ├── hello-plugin.js        ← installable example (/hello /ping /echo)
│   ├── custom-agent.js        ← minimal agent scaffold
│   └── antigravity-provider.js← provider skeleton (translation points)
├── package.json
├── LICENCE             ← HXZ non-commercial
└── README.md
```

## Quick start:

1. Copy the example and edit commands:

```bash
cp examples/hello-plugin.js my-plugin.js
node -e "require('./index.js').definePlugin(require('./my-plugin.js')); console.log('plugin valid')"
```

2. Send `my-plugin.js` to your bot as a document, reply to it with:

```
/plugin
```

3. Try your commands, manage with:

```
/pl ls            — list plugins
/pl info <id>     — details
/pl reload        — reload all after edits
/pl off <id>      — disable
/pl on <id>       — enable
/pl del <id>      — delete
```

Plugin contract:

```js
module.exports = {
  name: "hello",
  version: "1.0.0",
  description: "Says hello",
  commands: {
    hello: async (ctx, args, api) => { await ctx.reply("hi"); },
    echo: { description: "...", usage: "/echo <text>",
            handler: async (ctx, args, api) => {} },
  },
  onLoad(api) {},
  onUnload(api) {},
};
```

Or with the SDK validator:

```js
const { definePlugin } = require("htsdk");
module.exports = definePlugin({ name: "hello", commands: { /* ... */ } });
```

* `ctx` — Telegraf context (`ctx.reply`, `ctx.telegram`, `ctx.from`, …).
* `args` — text after the command (`/echo hi` → `"hi"`).
* `api` — `{ bot, config, runTool, storage, chat, log, pluginsDir }`.

Rules:

* Single file must be `.js` ≤ 500KB. Bundles must be `.zip` ≤ 5MB with
  `index.js` / `main.js` / `plugin.js` at root.
* Command names: `[A-Za-z0-9_]`, max 32 chars.
* Only the **owner** can install/manage plugins (arbitrary code = trust).
* Plugins cannot override built-ins (`/start`, `/login`, `/plugin`, `/pl`, …).

## custom agent

```js
const { createAgent } = require("htsdk");
const agent = createAgent({ baseURL: "https://api.openai.com/v1", apiKey: "sk-...", model: "gpt-4o-mini" });
const res = await agent.chat([{ role: "user", content: "hi" }]);
console.log(res.content, res.toolCalls);
```

See `examples/custom-agent.js`. Wire `agent.chat` into Telegraf, CLI, or HTTP
as you like — same `{ model, messages, tools }` shape the bot uses.

## Auth providers

The bot ships with three providers (`bot/auth.js`):

| Provider | How it authed | How chat works |
|---|---|---|
| `apikey` | `config.apis[]` baseURL + key | Direct OpenAI `/chat/completions` |
| `antigravity` | Google OAuth PKCE → refresh `rt\|project` | Translate OpenAI → Gemini `contents`, call `cloudcode-pa` gateway |
| `chatgpt` (experimental) | OAuth PKCE **or** manual token paste | Bearer against OpenAI-compatible `baseURL` (your proxy/API) |

To add your own backend, implement `defineProvider` (see
`auth-providers.js` + `examples/antigravity-provider.js`): `authorize`,
`exchange`, `refresh`, `chat`.

## License

HXZ License © 2026 — HexzoNetwork. Non-commercial use only; commercial use
needs written permission.
