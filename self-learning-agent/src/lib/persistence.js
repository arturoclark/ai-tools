const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { SLAError } = require("./errors");
const { withFileLock } = require("./filesystem");
const { getPersistenceActivityPath } = require("./paths");
const { assertProfileExists } = require("./profiles");

const OUTCOMES = new Set(["changed", "no-change", "failed", "skipped"]);
const SAFE_FAILURE_REASONS = new Set([
  "activity-record-failed",
  "dispatch-unavailable",
  "profile-unresolved",
  "write-failed",
]);

async function recordPersistenceActivity(input) {
  const record = await normalizeRecord(input);
  const activityPath = getPersistenceActivityPath();
  await fs.mkdir(path.dirname(activityPath), { recursive: true });

  return withFileLock(`${activityPath}.lock`, async () => {
    const existing = await readActivityRecords(activityPath);
    if (record.eventId) {
      const duplicate = existing.find((entry) => entry.eventId === record.eventId);
      if (duplicate) {
        return { recorded: false, record: duplicate };
      }
    }

    await fs.appendFile(activityPath, `${JSON.stringify(record)}\n`, "utf8");
    return { recorded: true, record };
  });
}

async function listPersistenceActivity(options = {}) {
  const records = await readActivityRecords(getPersistenceActivityPath());
  const profile = options.profile || null;
  const limit = options.limit ?? 20;
  const filtered = profile ? records.filter((entry) => entry.profiles.includes(profile)) : records;
  return { records: filtered.slice(-limit).reverse() };
}

async function normalizeRecord(input) {
  const outcome = String(input.outcome || "").trim();
  if (!OUTCOMES.has(outcome)) {
    throw new SLAError("Persistence outcome must be changed, no-change, failed, or skipped.", {
      code: "INVALID_PERSISTENCE_OUTCOME",
      exitCode: 2,
    });
  }

  const profiles = [...new Set((input.profiles || []).filter(Boolean))];
  for (const profile of profiles) {
    await assertProfileExists(profile);
  }

  const counts = {
    memory: validateCount(input.memory, "memory"),
    skills: validateCount(input.skills, "skills"),
    references: validateCount(input.references, "references"),
    operationalContext: validateCount(input.operationalContext, "operational context"),
  };
  const totalChanges = counts.memory + counts.skills + counts.references + counts.operationalContext;
  if (outcome === "changed" && totalChanges === 0) {
    throw new SLAError("A changed persistence outcome requires at least one recorded mutation.", {
      code: "INVALID_PERSISTENCE_COUNTS",
      exitCode: 2,
    });
  }
  if (["no-change", "skipped"].includes(outcome) && totalChanges !== 0) {
    throw new SLAError("No-change and skipped persistence outcomes cannot record mutations.", {
      code: "INVALID_PERSISTENCE_COUNTS",
      exitCode: 2,
    });
  }

  const failureReason = input.failureReason || null;
  if (failureReason && !SAFE_FAILURE_REASONS.has(failureReason)) {
    throw new SLAError("Persistence failure reason must be a supported safe reason code.", {
      code: "INVALID_PERSISTENCE_FAILURE_REASON",
      exitCode: 2,
    });
  }
  if (outcome === "failed" && !failureReason) {
    throw new SLAError("A failed persistence outcome requires a safe reason code.", {
      code: "PERSISTENCE_FAILURE_REASON_REQUIRED",
      exitCode: 2,
    });
  }
  if (outcome !== "failed" && failureReason) {
    throw new SLAError("A safe failure reason can only accompany a failed persistence outcome.", {
      code: "INVALID_PERSISTENCE_FAILURE_REASON",
      exitCode: 2,
    });
  }

  const eventId = normalizeEventId(input.eventId);

  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    eventId,
    recordedAt: new Date().toISOString(),
    profiles,
    outcome,
    counts,
    failureReason,
  };
}

function normalizeEventId(value) {
  if (value == null || value === "") {
    return null;
  }

  const eventId = String(value);
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(eventId)) {
    return eventId;
  }

  // Dispatch providers can expose otherwise stable identifiers containing local
  // paths or other unsafe source details. Keep idempotency without persisting
  // those details in the activity log or its CLI output.
  return `sha256:${crypto.createHash("sha256").update(eventId, "utf8").digest("hex")}`;
}

function validateCount(value, name) {
  const parsed = Number(value || 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new SLAError(`Persistence ${name} count must be a non-negative integer.`, {
      code: "INVALID_PERSISTENCE_COUNTS",
      exitCode: 2,
    });
  }
  return parsed;
}

async function readActivityRecords(activityPath) {
  let raw;
  try {
    raw = await fs.readFile(activityPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const records = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (isActivityRecord(record)) records.push(record);
    } catch (_error) {
      // A partial or legacy line must not make an activity view unavailable.
    }
  }
  return records;
}

function isActivityRecord(record) {
  return record && typeof record === "object" && Array.isArray(record.profiles) &&
    typeof record.outcome === "string" && record.counts && typeof record.counts === "object";
}

module.exports = {
  SAFE_FAILURE_REASONS,
  listPersistenceActivity,
  recordPersistenceActivity,
};
