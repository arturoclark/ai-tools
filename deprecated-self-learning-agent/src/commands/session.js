const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { attachExamples } = require("../lib/examples");
const { SLAError } = require("../lib/errors");
const { createRepositoryManifest, resolveRepositoryProfiles, validateProfiles } = require("../lib/repository-manifest");
const { writeResult } = require("../lib/output");

function registerSessionCommands(program) {
  const session = program.command("session").description("Configure repository profile routing for agent sessions.");

  session
    .command("install")
    .option("--profile <name>", "Existing profile to load, repeatable.", collectProfile, [])
    .option("--yes", "Overwrite an existing .sla manifest without prompting.")
    .description("Create a .sla manifest in the current directory.")
    .addHelpText("after", attachExamples(["sla session install --profile research", "sla session install --profile research --profile shared-engineering --yes"]))
    .action(async (options, command) => {
      validateProfiles(options.profile);
      const existing = await manifestExists(process.cwd());
      if (existing && !options.yes) {
        if (command.optsWithGlobals().json || !stdin.isTTY || !stdout.isTTY) {
          throw overwriteRequired();
        }
        if (!(await promptForOverwrite())) {
          throw new SLAError("Session manifest installation was cancelled.", {
            code: "SESSION_MANIFEST_INSTALL_CANCELLED",
            exitCode: 1,
          });
        }
      }

      const result = await createRepositoryManifest(process.cwd(), options.profile, { overwrite: options.yes || existing });
      return writeResult(command, { ok: true, data: result }, {
        human: `Configured SLA session profiles: ${result.profiles.join(", ")}\nManifest: ${result.manifestPath}${result.gitignore.changed ? "\nUpdated: .gitignore" : ""}`,
      });
    });

  session
    .command("bootstrap")
    .argument("[directory]", "Directory from which to find the nearest .sla manifest.")
    .description("Resolve repository-selected profiles and render their bootstrap contexts.")
    .addHelpText("after", attachExamples(["sla session bootstrap", "sla session bootstrap ./packages/api --json"]))
    .action(async (...args) => {
      const directory = args[0] || process.cwd();
      const command = args.at(-1);
      const result = await resolveRepositoryProfiles(directory);
      return writeResult(command, { ok: true, data: result }, {
        human: result.found
          ? result.profiles.map((entry) => entry.renderedContext.trimEnd()).join("\n\n")
          : "No repository .sla manifest found.",
      });
    });
}

function collectProfile(value, previous) {
  return [...previous, value];
}

async function manifestExists(directory) {
  const fs = require("node:fs/promises");
  const path = require("node:path");
  try {
    await fs.access(path.join(directory, ".sla"));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function overwriteRequired() {
  return new SLAError("A .sla manifest already exists. Re-run with --yes to overwrite it.", {
    code: "SESSION_MANIFEST_OVERWRITE_REQUIRED",
    exitCode: 1,
  });
}

async function promptForOverwrite() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("A .sla manifest already exists. Overwrite it? [y/N] ");
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

module.exports = { registerSessionCommands };
