/**
 * htsdk/auth-providers — define custom OAuth/API providers compatible with
 * HexTelegram's auth framework (auth.js in the bot).
 *
 * A provider translates between OpenAI-style chat calls and your backend.
 * Minimal example (API-key style, no translation):
 *
 *   module.exports = defineProvider({
 *     id: "myproxy",
 *     label: "My Proxy",
 *     authorize: async () => ({ url: "https://...", verifier: "..." }),
 *     exchange: async ({ code, verifier }) => ({ access, refresh, expires }),
 *     refresh: async (account) => account,
 *     chat: async ({ baseURL, token, model, messages, tools }) => ({
 *       content: "...", toolCalls: [], finishReason: "stop",
 *     }),
 *   });
 *
 * For a full translation example (Gemini-style gateway like Antigravity),
 * see examples/antigravity-provider.js.
 * Non-commercial (HXZ License).
 */
"use strict";

function defineProvider(def) {
  if (!def || typeof def !== "object") throw new Error("defineProvider: def must be an object");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(String(def.id || ""))) throw new Error("defineProvider: bad id");
  for (const k of ["authorize", "exchange", "refresh", "chat"]) {
    if (typeof def[k] !== "function") throw new Error(`defineProvider: '${k}' must be a function`);
  }
  return {
    id: String(def.id),
    label: String(def.label || def.id),
    description: String(def.description || ""),
    authorize: def.authorize,
    exchange: def.exchange,
    refresh: def.refresh,
    chat: def.chat,
  };
}

module.exports = { defineProvider };
