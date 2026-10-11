/**
 * Example auth provider skeleton (Gemini-style gateway, Antigravity-like).
 * This shows where translation happens if you add your own OAuth backend.
 * For the production Antigravity implementation, see the bot's auth.js.
 * Non-commercial (HXZ License).
 */
"use strict";

const { defineProvider } = require("../auth-providers.js");

module.exports = defineProvider({
  id: "my-gateway",
  label: "My Gateway",
  description: "Translate OpenAI messages -> Gemini-style contents, call gateway, map back.",

  async authorize() {
    throw new Error("Not implemented — see bot auth.js authorizeAntigravity()");
  },

  async exchange({ code, verifier }) {
    void code; void verifier;
    throw new Error("Not implemented — see bot auth.js exchangeAntigravity()");
  },

  async refresh(account) {
    return account;
  },

  async chat({ token, model, messages, tools }) {
    void token; void model; void messages; void tools;
    throw new Error("Not implemented — see bot auth.js antigravityChat()");
  },
});
