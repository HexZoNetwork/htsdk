/**
 * htsdk/plugin - helpers for HexTelegram plugins (re-exported by index.js).
 * Non-commercial (HXZ License).
 */
"use strict";
const base = require("./index.js");
module.exports = {
  definePlugin: base.definePlugin,
  testPlugin: base.testPlugin,
  testTool: base.testTool,
  testHook: base.testHook,
  HOOK_KINDS: base.HOOK_KINDS,
  splitTG: base.splitTG,
  escapeMarkdown: base.escapeMarkdown,
  commandArgs: base.commandArgs,
};
