const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { SLAError } = require("./errors");
const filesystem = require("./filesystem");
const { getOperationalContextPath } = require("./paths");
const { resolveExistingProfile } = require("./profiles");

const STORE_SCHEMA_VERSION = 1;

async function addOperationalContext(requestedName, input) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const entry = buildEntry(input);
  const storePath = getOperationalContextPath(profileName);
  await filesystem.ensureDirectory(path.dirname(storePath));

  return filesystem.withFileLock(`${storePath}.lock`, async () => {
    const current = await readOperationalContextStore(profileName);
    if (current.entries.some((existing) => isDuplicate(existing, entry))) {
      throw new SLAError("A materially identical operational-context entry already exists.", {
        code: "OPERATIONAL_CONTEXT_ENTRY_ALREADY_EXISTS",
        exitCode: 2,
        details: { profile: profileName },
      });
    }

    const nextStore = { schemaVersion: STORE_SCHEMA_VERSION, entries: [...current.entries, entry] };
    await filesystem.writeFileAtomic(storePath, serializeStore(nextStore));
    return { profile: profileName, entry, entryCount: nextStore.entries.length, path: storePath };
  });
}

async function listOperationalContext(requestedName) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const store = await readOperationalContextStore(profileName);
  return { profile: profileName, entryCount: store.entries.length, entries: store.entries };
}

async function listActiveOperationalContext(requestedName, options = {}) {
  const result = await listOperationalContext(requestedName);
  const now = options.now || new Date();
  const entries = result.entries.filter((entry) => isOperationalContextActive(entry, now));
  return { profile: result.profile, entryCount: entries.length, entries };
}

async function viewOperationalContext(requestedName, id) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const store = await readOperationalContextStore(profileName);
  const entry = findEntryById(store.entries, id);
  return { profile: profileName, entry, path: getOperationalContextPath(profileName) };
}

async function removeOperationalContext(requestedName, id) {
  const { profileName } = await resolveExistingProfile(requestedName);
  const storePath = getOperationalContextPath(profileName);

  if (!(await filesystem.pathExists(storePath))) {
    findEntryById([], id);
  }

  return filesystem.withFileLock(`${storePath}.lock`, async () => {
    const current = await readOperationalContextStore(profileName);
    const entry = findEntryById(current.entries, id);
    const nextStore = {
      schemaVersion: STORE_SCHEMA_VERSION,
      entries: current.entries.filter((currentEntry) => currentEntry.id !== entry.id),
    };
    await filesystem.writeFileAtomic(storePath, serializeStore(nextStore));
    return { profile: profileName, removedEntry: entry, entryCount: nextStore.entries.length, path: storePath };
  });
}

async function readOperationalContextStore(profileName) {
  const storePath = getOperationalContextPath(profileName);
  if (!(await filesystem.pathExists(storePath))) {
    return { schemaVersion: STORE_SCHEMA_VERSION, entries: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(storePath, "utf8"));
  } catch (error) {
    throw new SLAError("Operational-context storage is malformed.", {
      code: "OPERATIONAL_CONTEXT_STORE_INVALID",
      exitCode: 1,
      details: { path: storePath, cause: error?.code || "INVALID_JSON" },
    });
  }

  if (parsed?.schemaVersion !== STORE_SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
    throw new SLAError("Operational-context storage has an unsupported schema.", {
      code: "OPERATIONAL_CONTEXT_STORE_INVALID",
      exitCode: 1,
      details: { path: storePath },
    });
  }

  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    entries: parsed.entries.map(validateStoredEntry),
  };
}

function buildEntry(input = {}) {
  const content = normalizeContent(input.content);
  const expiresAt = normalizeExpiry(input.expiresAt);
  const resolutionCondition = normalizeResolutionCondition(input.resolutionCondition);
  assertLifecycle(expiresAt, resolutionCondition);

  return {
    id: crypto.randomUUID(),
    content,
    createdAt: new Date().toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
    ...(resolutionCondition ? { resolutionCondition } : {}),
  };
}

function normalizeContent(value) {
  const content = String(value ?? "").replaceAll("\r\n", "\n").trim();
  if (!content) {
    throw new SLAError("Operational-context content may not be empty.", {
      code: "INVALID_OPERATIONAL_CONTEXT_CONTENT",
      exitCode: 2,
    });
  }
  return content;
}

function normalizeExpiry(value) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new SLAError("Expiry must be a valid timestamp.", {
      code: "INVALID_OPERATIONAL_CONTEXT_EXPIRY",
      exitCode: 2,
      details: { expiresAt: value },
    });
  }
  return parsed.toISOString();
}

function normalizeResolutionCondition(value) {
  if (value == null || value === "") {
    return null;
  }
  const condition = String(value).replaceAll("\r\n", "\n").trim();
  if (!condition) {
    throw new SLAError("Resolution condition may not be empty.", {
      code: "INVALID_OPERATIONAL_CONTEXT_RESOLUTION_CONDITION",
      exitCode: 2,
    });
  }
  return condition;
}

function assertLifecycle(expiresAt, resolutionCondition) {
  if (!expiresAt && !resolutionCondition) {
    throw new SLAError("Provide at least one lifecycle trigger: --expires-at or --resolution-condition.", {
      code: "OPERATIONAL_CONTEXT_LIFECYCLE_REQUIRED",
      exitCode: 2,
    });
  }
}

function validateOperationalContextLifecycle(input = {}) {
  const expiresAt = normalizeExpiry(input.expiresAt);
  const resolutionCondition = normalizeResolutionCondition(input.resolutionCondition);
  assertLifecycle(expiresAt, resolutionCondition);
  return { expiresAt, resolutionCondition };
}

function validateStoredEntry(entry) {
  if (!entry || typeof entry.id !== "string" || !entry.id || typeof entry.createdAt !== "string") {
    throw new SLAError("Operational-context storage contains an invalid entry.", {
      code: "OPERATIONAL_CONTEXT_STORE_INVALID",
      exitCode: 1,
    });
  }
  const content = normalizeContent(entry.content);
  const { expiresAt, resolutionCondition } = validateOperationalContextLifecycle(entry);
  return { id: entry.id, content, createdAt: entry.createdAt, ...(expiresAt ? { expiresAt } : {}), ...(resolutionCondition ? { resolutionCondition } : {}) };
}

function findEntryById(entries, id) {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new SLAError("No operational-context entry matched the provided ID.", {
      code: "OPERATIONAL_CONTEXT_ENTRY_NOT_FOUND",
      exitCode: 1,
      details: { id },
    });
  }
  return entry;
}

function isDuplicate(left, right) {
  return left.content === right.content
    && (left.expiresAt || null) === (right.expiresAt || null)
    && (left.resolutionCondition || null) === (right.resolutionCondition || null);
}

function isOperationalContextActive(entry, now = new Date()) {
  return !entry.expiresAt || new Date(entry.expiresAt).getTime() > now.getTime();
}

function serializeStore(store) {
  return `${JSON.stringify(store, null, 2)}\n`;
}

module.exports = {
  addOperationalContext,
  isOperationalContextActive,
  listActiveOperationalContext,
  listOperationalContext,
  removeOperationalContext,
  validateOperationalContextLifecycle,
  viewOperationalContext,
};
