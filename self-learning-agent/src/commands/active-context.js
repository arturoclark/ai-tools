const { attachExamples } = require("../lib/examples");
const {
  addOperationalContext,
  listOperationalContext,
  removeOperationalContext,
  viewOperationalContext,
} = require("../lib/operational-context");
const { writeResult } = require("../lib/output");
const { validateProfileName } = require("../lib/validation");

function registerActiveContextCommands(program) {
  const activeContext = program.command("active-context").description("Manage expiring operational context.");

  activeContext
    .command("add")
    .argument("<name>", "Profile name.", validateProfileName)
    .requiredOption("--entry <text>", "Operational-context content to add.")
    .option("--expires-at <timestamp>", "Optional expiry timestamp.")
    .option("--resolution-condition <text>", "Optional condition for explicit resolution.")
    .description("Add lifecycle-qualified operational context.")
    .addHelpText("after", attachExamples(["sla active-context add research --entry \"Incident bridge is active\" --expires-at 2026-09-09T00:00:00Z"]))
    .action(async (...args) => {
      const [name, options, command] = [args[0], args[1], args.at(-1)];
      const result = await addOperationalContext(name, {
        content: options.entry,
        expiresAt: options.expiresAt,
        resolutionCondition: options.resolutionCondition,
      });
      return writeResult(command, { ok: true, data: result }, { human: `Added operational-context entry '${result.entry.id}' for profile '${result.profile}'.` });
    });

  activeContext
    .command("list")
    .argument("<name>", "Profile name.", validateProfileName)
    .description("List operational-context entries for a profile.")
    .addHelpText("after", attachExamples(["sla active-context list research --json"]))
    .action(async (...args) => {
      const result = await listOperationalContext(args[0]);
      const human = result.entries.length
        ? result.entries.map((entry) => `- ${entry.id}: ${entry.content}`).join("\n")
        : "(no operational-context entries)";
      return writeResult(args.at(-1), { ok: true, data: result }, { human });
    });

  activeContext
    .command("view")
    .argument("<name>", "Profile name.", validateProfileName)
    .requiredOption("--id <id>", "Stable operational-context entry ID.")
    .description("View one operational-context entry by ID.")
    .addHelpText("after", attachExamples(["sla active-context view research --id <entry-id> --json"]))
    .action(async (...args) => {
      const result = await viewOperationalContext(args[0], args[1].id);
      return writeResult(args.at(-1), { ok: true, data: result }, { human: JSON.stringify(result.entry, null, 2) });
    });

  activeContext
    .command("remove")
    .alias("resolve")
    .argument("<name>", "Profile name.", validateProfileName)
    .requiredOption("--id <id>", "Stable operational-context entry ID.")
    .description("Remove one operational-context entry by ID.")
    .addHelpText("after", attachExamples(["sla active-context remove research --id <entry-id>"]))
    .action(async (...args) => {
      const result = await removeOperationalContext(args[0], args[1].id);
      return writeResult(args.at(-1), { ok: true, data: result }, { human: `Removed operational-context entry '${result.removedEntry.id}' from profile '${result.profile}'.` });
    });
}

module.exports = { registerActiveContextCommands };
