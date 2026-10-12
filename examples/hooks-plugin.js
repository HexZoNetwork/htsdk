/**
 * Hooks demo plugin - shows how one file modifies input, response, and flow.
 * Install it, then try: "shout: hello there" as a normal chat message.
 * Copy patterns from here into your own plugin, then delete this file.
 * Non-commercial (HXZ License).
 */
"use strict";

const SHOUT_PREFIX = "shout:";

module.exports = {
  name: "hooks-demo",
  version: "1.0.0",
  description: "Demo: input/output/beforeTool/afterTool hooks.",

  commands: {
    hooks: {
      description: "Explain what this demo does",
      usage: "/hooks",
      handler: async (ctx) => {
        await ctx.reply(
          "Hooks demo active. Send `shout: <text>` to see input+output hooks. " +
          "Tool calls pass through beforeTool/afterTool below.",
          { parse_mode: "Markdown" }
        );
      },
    },
  },

  hooks: {
    input: async (text) => {
      const t = String(text || "");
      if (t.toLowerCase().startsWith(SHOUT_PREFIX)) {
        return t.slice(SHOUT_PREFIX.length).trim().toUpperCase();
      }
      return t;
    },

    output: async (text) => String(text || "") + "\n\n(hooks demo)",

    beforeTool: async (name, args) => {
      if (name === "shell_exec" && /rm\s+-rf\s+\//.test(String((args || {}).command || ""))) {
        return { block: "hooks demo refuses destructive shell commands" };
      }
      return null;
    },

    afterTool: async (name, args, result) => result,
  },
};
