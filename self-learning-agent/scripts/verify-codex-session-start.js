#!/usr/bin/env node

// Opt-in, read-only profile verification for an installed SLA CLI and Codex.
const { execFileSync } = require("node:child_process");

const profile = process.env.SLA_LIFECYCLE_EXISTING_PROFILE;
if (!profile) {
  process.stderr.write("Refusing to run: set SLA_LIFECYCLE_EXISTING_PROFILE to an existing non-empty profile.\n");
  process.exit(2);
}

function context() {
  return JSON.parse(execFileSync("sla", ["profile", "context", profile, "--json"], { encoding: "utf8" }));
}

const before = context();
const data = before?.data;
const soulHasContent = typeof data?.soul?.raw === "string" && data.soul.raw.trim() !== "# SOUL";
const hasEntries = (data?.memories?.totalEntries || 0) > 0;
const hasSkills = (data?.skills?.count || 0) > 0;
if (!before?.ok || !(soulHasContent || hasEntries || hasSkills)) {
  process.stderr.write("Refusing to run: the named profile must contain a soul, memory, or skill beyond the empty scaffold.\n");
  process.exit(2);
}

process.stdout.write(JSON.stringify({
  profile,
  before: data,
  instructions: [
    "Create a disposable repository and its .sla manifest with this profile.",
    "Install the Codex hook there, start or resume Codex, and compare SessionStart context to before.",
    "Run this script again; its before snapshot must remain equivalent because SessionStart is read-only.",
  ],
}, null, 2) + "\n");
