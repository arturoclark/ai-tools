const { Command } = require("commander");
const { registerHelpCommand } = require("./help");
const { registerHostCommands } = require("./host");
const { registerInstallCommand } = require("./install");
const { registerMemoryCommands } = require("./memory");
const { registerProfileCommands } = require("./profile");
const { registerSkillCommands } = require("./skill");
const { registerSoulCommands } = require("./soul");
const { registerStatsCommands } = require("./stats");
const { registerSessionCommands } = require("./session");
const { registerPersistenceCommands } = require("./persistence");
const { registerActiveContextCommands } = require("./active-context");
const { attachExamples } = require("../lib/examples");
const { ensureSchemaReady } = require("../lib/bootstrap");
const { loadConfig } = require("../lib/config");
const { setRuntimeOptions } = require("../lib/paths");
const { listProfiles } = require("../lib/profiles");
const { getProfileStats } = require("../lib/stats");
const { viewSoul } = require("../lib/soul");

function buildRootCommand() {
  const program = new Command();

  program
    .name("sla")
    .description("Profile-scoped memory and skills CLI for agents.")
    .helpCommand(false)
    .showHelpAfterError("(use --help for usage)")
    .showSuggestionAfterError()
    .option("--json", "Emit machine-readable JSON output.")
    .option("--hermes-agent", "Use the Hermes storage home for this invocation.")
    .hook("preAction", async (command) => {
      const opts = command.optsWithGlobals();
      setRuntimeOptions({ hermesAgent: opts.hermesAgent });
      if (opts.json) {
        command.configureOutput({
          writeOut: (str) => process.stdout.write(str),
          writeErr: (str) => process.stderr.write(str),
          outputError: (str, write) => write(str),
        });
      }

      await ensureSchemaReady();
    })
    .addHelpText(
      "after",
      attachExamples([
        "sla install",
        "sla profile list",
        "sla help skill create",
        "sla memory add default --target memory --entry \"The API runs in us-east-1\"",
      ]),
    )
    .action(async () => {
      const profileTable = program.opts().json ? null : await formatProfileTable();
      if (profileTable) {
        process.stdout.write(`${profileTable}\n\n`);
      }
      program.outputHelp();
    });

  registerInstallCommand(program);
  registerProfileCommands(program);
  registerSoulCommands(program);
  registerMemoryCommands(program);
  registerSkillCommands(program);
  registerStatsCommands(program);
  registerSessionCommands(program);
  registerPersistenceCommands(program);
  registerActiveContextCommands(program);
  registerHostCommands(program);
  registerHelpCommand(program);

  program.configureOutput({
    outputError: (str, write) => write(str),
  });

  program.exitOverride((error) => {
    if (error.code === "commander.helpDisplayed") {
      return;
    }

    throw error;
  });

  return program;
}

async function formatProfileTable() {
  if (!(await loadConfig())) {
    return null;
  }

  const { profiles } = await listProfiles();
  if (profiles.length === 0) {
    return null;
  }

  const rows = await Promise.all(
    profiles.map(async (profile) => {
      const [stats, soul] = await Promise.all([getProfileStats(profile.name), viewSoul(profile.name)]);
      return {
        name: `${profile.name}${profile.isDefault ? " (default)" : ""}`,
        lastUsed: stats.lastActivity?.at ?? "never",
        purpose: formatSoulPurpose(soul.raw),
      };
    }),
  );

  rows.sort((left, right) => {
    if (left.lastUsed === "never") {
      return 1;
    }
    if (right.lastUsed === "never") {
      return -1;
    }
    return new Date(right.lastUsed).getTime() - new Date(left.lastUsed).getTime();
  });

  const headers = ["Profile", "Last used", "Purpose"];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => Object.values(row)[index].length)),
  );
  const renderRow = (values, colorProfile = false) =>
    values
      .map((value, index) => {
        const padded = value.padEnd(widths[index]);
        return colorProfile && index === 0 ? colorProfileName(padded) : padded;
      })
      .join("  ");

  return [renderRow(headers), renderRow(widths.map((width) => "-".repeat(width)))].concat(
    rows.map((row) => renderRow([row.name, row.lastUsed, row.purpose], true)),
  ).join("\n");
}

function formatSoulPurpose(raw) {
  const purpose = raw
    .replace(/^# SOUL\s*\n?/i, "")
    .trim()
    .replace(/\s+/g, " ");

  return purpose || "—";
}

function colorProfileName(name) {
  if (!process.stdout.isTTY || process.env.NO_COLOR) {
    return name;
  }

  return `\x1b[36m${name}\x1b[0m`;
}

module.exports = {
  buildRootCommand,
};
