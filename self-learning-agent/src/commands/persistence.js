const { attachExamples } = require("../lib/examples");
const { listPersistenceActivity, recordPersistenceActivity, SAFE_FAILURE_REASONS } = require("../lib/persistence");
const { writeResult } = require("../lib/output");
const { validateProfileName } = require("../lib/validation");

function registerPersistenceCommands(program) {
  const persistence = program.command("persistence").description("Inspect and record concise SLA persistence-review activity.");

  persistence
    .command("record")
    .requiredOption("--outcome <outcome>", "changed, no-change, failed, or skipped.")
    .option("--profile <name>", "Active profile involved in the review; repeatable.", collectProfile, [])
    .option("--memory <count>", "Number of memory mutations.", parseCount, 0)
    .option("--skills <count>", "Number of skill mutations.", parseCount, 0)
    .option("--references <count>", "Number of reference mutations.", parseCount, 0)
    .option("--failure-reason <code>", `Safe failure code: ${[...SAFE_FAILURE_REASONS].join(", ")}.`)
    .option("--event-id <id>", "Optional stable dispatch identifier; duplicate IDs are recorded once.")
    .description("Record a redacted result from one persistence-review invocation.")
    .addHelpText("after", attachExamples([
      "sla persistence record --profile research --outcome no-change",
      "sla persistence record --profile research --outcome changed --memory 1 --event-id session-42",
      "sla persistence record --outcome failed --failure-reason dispatch-unavailable",
    ]))
    .action(async (options, command) => {
      const result = await recordPersistenceActivity({
        profiles: options.profile,
        outcome: options.outcome,
        memory: options.memory,
        skills: options.skills,
        references: options.references,
        failureReason: options.failureReason,
        eventId: options.eventId,
      });
      return writeResult(command, { ok: true, data: result }, {
        human: result.recorded ? "Recorded SLA persistence activity." : "SLA persistence activity was already recorded.",
      });
    });

  persistence
    .command("activity")
    .argument("[profile]", "Optional profile to filter.", validateOptionalProfileName)
    .option("--limit <count>", "Maximum records to show (default: 20).", parseLimit, 20)
    .description("Show concise, redacted persistence-review outcomes.")
    .addHelpText("after", attachExamples(["sla persistence activity", "sla persistence activity research --limit 10", "sla persistence activity --json"]))
    .action(async (...args) => {
      const profile = args[0];
      const options = args[1];
      const command = args.at(-1);
      const result = await listPersistenceActivity({ profile, limit: options.limit });
      return writeResult(command, { ok: true, data: result }, {
        human: result.records.length ? result.records.map(formatRecord).join("\n") : "No SLA persistence activity recorded.",
      });
    });
}

function collectProfile(value, previous) {
  return [...previous, validateProfileName(value)];
}

function parseCount(value) {
  return Number(value);
}

function parseLimit(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("Persistence activity limit must be an integer from 1 through 100.");
  }
  return parsed;
}

function validateOptionalProfileName(value) {
  return value == null ? value : validateProfileName(value);
}

function formatRecord(record) {
  const profiles = record.profiles.length ? record.profiles.join(",") : "none";
  const counts = `memory=${record.counts.memory}; skills=${record.counts.skills}; references=${record.counts.references}`;
  return `${record.recordedAt} profiles=${profiles}; ${record.outcome}; ${counts}${record.failureReason ? `; failed: ${record.failureReason}` : ""}.`;
}

module.exports = { registerPersistenceCommands };
