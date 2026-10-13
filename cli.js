#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const sdk = require("./index.js");

function usage() {
  console.log([
    "htsdk cli - scaffold, validate, and dry-run HexTelegram plugins",
    "",
    "  htsdk new <id> [dir]                    write <id>.js skeleton",
    "  htsdk check <file>                      validate shape, print summary",
    "  htsdk test <file> <command> [args...]   dry-run a slash command",
    '  htsdk tool <file> <name> [json]         dry-run an agent tool',
    '  htsdk hook <file> <kind> [json-array]   dry-run a hook',
    "  htsdk help                              this text",
    "",
    "Install: npm install github:HexZoNetwork/htsdk",
    "Without install: node /path/to/htsdk/cli.js <cmd> ...",
    "",
    "Kinds: input, output, beforeTool, afterTool.",
  ].join("\n"));
}

function fail(msg) {
  console.error("error: " + msg);
  process.exit(1);
}

function loadFile(file) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) fail("no such file: " + file);
  delete require.cache[resolved];
  let mod = require(resolved);
  if (mod && mod.__esModule && mod.default) mod = mod.default;
  return { mod, resolved };
}

function summarize(plugin) {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    commands: Object.keys(plugin.commands),
    tools: Object.keys(plugin.tools),
    hooks: Object.fromEntries(Object.entries(plugin.hooks).map(([k, v]) => [k, v.length])),
  };
}

function skeleton(id) {
  return sdk.scaffoldPlugin(id);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") { usage(); return; }

  if (cmd === "new") {
    const id = String(rest[0] || "").trim();
    if (!sdk.validId(id)) fail("bad id (use [A-Za-z0-9_-], max 48)");
    const dir = rest[1] ? path.resolve(rest[1]) : process.cwd();
    const dest = path.join(dir, id + ".js");
    if (fs.existsSync(dest)) fail("already exists: " + dest);
    fs.writeFileSync(dest, skeleton(id));
    console.log("wrote " + dest);
    return;
  }

  if (cmd === "check") {
    const file = rest[0];
    if (!file) fail("usage: node cli.js check <file>");
    const { mod } = loadFile(file);
    const plugin = sdk.definePlugin(mod && mod.__esModule && mod.default ? mod.default : mod);
    console.log(JSON.stringify(summarize(plugin), null, 2));
    return;
  }

  if (cmd === "test") {
    const [file, command, ...args] = rest;
    if (!file || !command) fail("usage: node cli.js test <file> <command> [args...]");
    const r = await sdk.testPlugin(path.resolve(file), command, args.join(" "));
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(1);
    return;
  }

  if (cmd === "tool") {
    const [file, name, json] = rest;
    if (!file || !name) fail("usage: node cli.js tool <file> <name> [json]");
    let args = {};
    if (json !== undefined) {
      try { args = JSON.parse(json); }
      catch { fail("args must be JSON"); }
    }
    const r = await sdk.testTool(path.resolve(file), name, args);
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(1);
    return;
  }

  if (cmd === "hook") {
    const [file, kind, json] = rest;
    if (!file || !kind) fail("usage: node cli.js hook <file> <kind> [json-array]");
    let hookArgs = [];
    if (json !== undefined) {
      try {
        hookArgs = JSON.parse(json);
        if (!Array.isArray(hookArgs)) throw new Error("not array");
      } catch { fail("hook args must be a JSON array"); }
    }
    const r = await sdk.testHook(path.resolve(file), kind, ...hookArgs);
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(1);
    return;
  }

  fail("unknown command: " + cmd + " (try: node cli.js help)");
}

main().catch((e) => fail(String((e && e.message) || e)));
