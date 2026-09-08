#!/usr/bin/env node

// Opt-in integration check for the Codex Stop -> root -> custom-subagent handoff.
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (process.env.SLA_PERSISTENCE_DISPATCH_CHECK !== "1") {
  process.stderr.write("Refusing to run: set SLA_PERSISTENCE_DISPATCH_CHECK=1 to invoke Codex with disposable state.\n");
  process.exit(2);
}

const codexCommand = process.env.CODEX_BIN || "codex";
const keepTemporaryFiles = process.env.SLA_PERSISTENCE_DISPATCH_KEEP_TEMP === "1";
const repositoryRoot = path.join(__dirname, "..");
const cliPath = path.join(repositoryRoot, "bin", "sla.js");
const sourceCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");

async function main() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sla-codex-persistence-dispatch-"));
  const slaHome = path.join(temporaryRoot, "sla-home");
  const codexHome = path.join(temporaryRoot, "codex-home");
  const repositoryPath = path.join(temporaryRoot, "repository");
  const lastMessagePath = path.join(temporaryRoot, "last-message.txt");
  const env = { ...process.env, SLA_HOME: slaHome, CODEX_HOME: codexHome };

  try {
    await Promise.all([
      fs.mkdir(codexHome, { recursive: true }),
      fs.mkdir(repositoryPath, { recursive: true }),
    ]);
    await copyFileBackedCodexAuthentication(sourceCodexHome, codexHome, env);
    run(process.execPath, [cliPath, "install", "--json"], { env });
    await fs.writeFile(
      path.join(repositoryPath, ".sla"),
      `${JSON.stringify({ schemaVersion: 1, profiles: ["default"] })}\n`,
      "utf8",
    );
    // Install into the disposable user-level CODEX_HOME. A repository-local
    // .codex layer is ignored until Codex trusts that new project layer.
    run(process.execPath, [cliPath, "host", "install", "codex", "--yes", "--json"], { env });

    run(codexCommand, [
      "exec",
      "--skip-git-repo-check",
      "--dangerously-bypass-hook-trust",
      "--sandbox",
      "read-only",
      "--output-last-message",
      lastMessagePath,
      "--cd",
      repositoryPath,
      "Reply with exactly: dispatch check.",
    ], { env, timeout: 300_000 });

    const lastMessage = await fs.readFile(lastMessagePath, "utf8");
    if (!/SLA persistence review:\s*profiles=default;\s*no-change\./i.test(lastMessage)) {
      throw new Error(`Codex did not surface the expected persistence-review result. Last message:\n${lastMessage}`);
    }

    process.stdout.write("Verified one Codex SLA persistence-review subagent dispatch with disposable state.\n");
  } finally {
    if (keepTemporaryFiles) {
      process.stderr.write(
        `Keeping disposable check state at ${temporaryRoot}; it may contain a temporary copy of file-backed Codex authentication. Delete it after diagnosis.\n`,
      );
    } else {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

async function copyFileBackedCodexAuthentication(sourceHome, destinationHome, env) {
  if (env.CODEX_ACCESS_TOKEN || env.OPENAI_API_KEY) {
    return;
  }

  const sourcePath = path.join(sourceHome, "auth.json");
  const destinationPath = path.join(destinationHome, "auth.json");
  try {
    await fs.copyFile(sourcePath, destinationPath);
    await fs.chmod(destinationPath, 0o600);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: options.env,
    timeout: options.timeout,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}:\n${result.stderr || result.stdout}`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exit(1);
});
