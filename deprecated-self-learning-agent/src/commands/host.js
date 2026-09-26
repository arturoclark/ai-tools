const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { attachExamples } = require("../lib/examples");
const { hostInstallRequiresOverwrite, installHost, listHosts, uninstallHostHooks } = require("../lib/hosts");
const { SLAError } = require("../lib/errors");
const { writeResult } = require("../lib/output");
const { validateProfileName } = require("../lib/validation");

function registerHostCommands(program) {
  const host = program.command("host").description("Manage host integrations.");

  host
    .command("install")
    .argument("<host>", "Host integration name.")
    .argument("[repository]", "Optional repository path shorthand for a repository-local hook install.")
    .option("--yes", "Overwrite existing host wrapper files without prompting.")
    .option("--gitignore", "When installing into a repository, append the host configuration directory to an existing .gitignore if needed.")
    .option("--repository <path>", "Install the host hook into a repository-local host configuration directory.")
    .option("--hermes-profile <name>", "Install Hermes wrapper skills into an existing Hermes profile.", validateProfileName)
    .description("Install host-facing wrappers.")
    .addHelpText(
      "after",
      attachExamples([
        "sla host install codex",
        "sla host install claude",
        "sla host install cursor",
        "sla host install codex --yes",
        "sla host install claude --yes",
        "sla host install cursor --yes",
        "sla host install codex . --yes",
        "sla host install claude . --yes",
        "sla host install cursor . --yes",
        "sla host install codex . --gitignore --yes",
        "sla host install claude . --gitignore --yes",
        "sla host install cursor . --gitignore --yes",
        "sla host install codex --repository ~/development/self-learning-agent",
        "sla host install claude --repository ~/development/self-learning-agent",
        "sla host install cursor --repository ~/development/self-learning-agent",
      ]),
    )
    .action(async (...args) => {
      const hostName = args[0];
      const repositoryArg = args[1];
      const options = normalizeInstallOptions(args[2], repositoryArg);
      const command = args.at(-1);
      const overwriteStatus = await hostInstallRequiresOverwrite(hostName, options);

      if (overwriteStatus.requiresOverwrite && !options.yes) {
        if (command.optsWithGlobals().json || !stdin.isTTY || !stdout.isTTY) {
          throw new SLAError("Existing host wrapper files were found. Re-run with --yes to overwrite them.", {
            code: "HOST_INSTALL_OVERWRITE_REQUIRED",
            exitCode: 1,
            details: {
              host: hostName,
              existingFiles: overwriteStatus.existingFiles,
            },
          });
        }

        const confirmed = await promptForOverwrite(hostName, overwriteStatus.existingFiles);
        if (!confirmed) {
          throw new SLAError("Host install was cancelled. Existing host wrapper files were not overwritten.", {
            code: "HOST_INSTALL_CANCELLED",
            exitCode: 1,
            details: {
              host: hostName,
              existingFiles: overwriteStatus.existingFiles,
            },
          });
        }
      }

      const result = await installHost(hostName, options);

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        {
          human:
            result.hooksConfigPath
              ? `Installed ${result.host} host wrappers at ${result.installPath} and the stop hook at ${result.hooksConfigPath}.`
              : `Installed ${result.host} host wrappers at ${result.installPath}.`,
        },
      );
    });

  host
    .command("list")
    .description("List supported host integrations and installation status.")
    .addHelpText("after", attachExamples(["sla host list", "sla host list --json"]))
    .action(async (...args) => {
      const command = args.at(-1);
      const result = await listHosts();
      const human = result.hosts
        .map((entry) =>
          entry.installed
            ? `${entry.host}: installed at ${entry.installPath}`
            : `${entry.host}: available, not installed`,
        )
        .join("\n");

      return writeResult(
        command,
        {
          ok: true,
          data: result,
        },
        { human },
      );
    });

  host
    .command("uninstall-hooks")
    .argument("<host>", "Host integration name.")
    .argument("[repository]", "Optional repository path shorthand for a repository-local hook uninstall.")
    .option("--repository <path>", "Remove managed hooks from a repository-local host configuration directory.")
    .description("Remove SLA-managed hooks while preserving host skills and unrelated hooks.")
    .addHelpText("after", attachExamples([
      "sla host uninstall-hooks codex",
      "sla host uninstall-hooks codex --repository .",
    ]))
    .action(async (...args) => {
      const hostName = args[0];
      const repositoryArg = args[1];
      const options = normalizeInstallOptions(args[2], repositoryArg);
      const command = args.at(-1);
      const result = await uninstallHostHooks(hostName, options);
      return writeResult(command, { ok: true, data: result }, {
        human: `Removed SLA-managed ${result.host} hooks.`,
      });
    });
}

module.exports = {
  registerHostCommands,
};

function normalizeInstallOptions(options, repositoryArg) {
  if (repositoryArg == null) {
    return options;
  }

  if (options.repository && options.repository !== repositoryArg) {
    throw new SLAError("The repository path was provided twice with different values.", {
      code: "HOST_INSTALL_REPOSITORY_CONFLICT",
      exitCode: 2,
      details: {
        repositoryArgument: repositoryArg,
        repositoryOption: options.repository,
      },
    });
  }

  return {
    ...options,
    repository: repositoryArg,
  };
}

async function promptForOverwrite(hostName, existingFiles) {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    stdout.write(
      [
        `Existing ${hostName} host wrapper files were found:`,
        ...existingFiles.map((filePath) => `- ${filePath}`),
        "",
      ].join("\n"),
    );
    const answer = await rl.question("Overwrite them? [y/N] ");
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
