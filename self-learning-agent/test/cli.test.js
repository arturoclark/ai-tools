const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("path");
const { spawnSync } = require("node:child_process");
const filesystem = require("../src/lib/filesystem");
const operationalContext = require("../src/lib/operational-context");

const repoRoot = path.join(__dirname, "..");
const cliPath = path.join(__dirname, "..", "bin", "sla.js");

function run(args, options = {}) {
  return runCommand(process.execPath, [cliPath, ...args], options);
}

function runHermes(args, options = {}) {
  return run(["--hermes-agent", ...args], options);
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd || repoRoot,
    input: options.input,
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function runExternal(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd || repoRoot,
    input: options.input,
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

test("prints top-level help", () => {
  const result = run(["help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Profile-scoped memory and skills CLI for agents\./);
  assert.match(result.stdout, /Examples:/);
  assert.match(result.stdout, /sla install/);
});

test("prints profiles by most recent activity before bare-command help", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["soul", "edit", "research", "--stdin"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nResearch profile for infrastructure work.\n",
  });

  const result = run([], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Profile\s+Last used\s+Purpose/m);
  assert.match(result.stdout, /research\s+.*Research profile for infrastructure work\./);
  assert.ok(result.stdout.indexOf("research") < result.stdout.indexOf("default"));
  assert.ok(result.stdout.indexOf("Usage:") > result.stdout.indexOf("Purpose"));
});

test("prints focused command help", () => {
  const result = run(["help", "profile", "create"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Create a named profile\./);
  assert.match(result.stdout, /sla profile create research/);
});

test("returns machine-readable JSON errors", async () => {
  const slaHome = await createTempSlaHome();
  const result = run(["profile", "list", "--json"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.ok, false);
  assert.equal(parsed.error.code, "SLA_NOT_INITIALIZED");
});

test("validates names with explicit errors", () => {
  const result = run(["profile", "create", "../bad"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /INVALID_PROFILE_NAME/);
});

test("bootstraps SLA home on install", async () => {
  const slaHome = await createTempSlaHome();

  const result = run(["install"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Initialized SLA/);

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.defaultProfile, "default");
  assert.deepEqual(config.hosts, {});

  await assertPathExists(path.join(slaHome, "default", "SOUL.md"));
  await assertPathExists(path.join(slaHome, "default", "memories", "MEMORY.md"));
  await assertPathExists(path.join(slaHome, "default", "memories", "USER.md"));
  await assertPathExists(path.join(slaHome, "default", "skills", ".usage.json"));
});

test("bootstraps Hermes home on install", async () => {
  const hermesHome = await createTempSlaHome();

  const result = runHermes(["install"], { env: { SLA_HOME: hermesHome } });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Initialized SLA/);

  const config = JSON.parse(await fs.readFile(path.join(hermesHome, "config.json"), "utf8"));
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.agentFlavor, "hermes");
  assert.equal(config.defaultProfile, "default");
  assert.deepEqual(config.hosts, {});

  await assertPathExists(path.join(hermesHome, "profiles", "default", "SOUL.md"));
  await assertPathExists(path.join(hermesHome, "profiles", "default", "memories", "MEMORY.md"));
  await assertPathExists(path.join(hermesHome, "profiles", "default", "memories", "USER.md"));
  await assertPathExists(path.join(hermesHome, "profiles", "default", "skills", ".usage.json"));
  await assertPathMissing(path.join(hermesHome, "default"));
});

test("rerunning install is idempotent", async () => {
  const slaHome = await createTempSlaHome();

  const first = run(["install", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(first.status, 0);

  const second = run(["install", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(second.status, 0);

  const parsed = JSON.parse(second.stdout);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.data.created.directories, []);
  assert.deepEqual(parsed.data.created.files, []);
});

test("schema mismatch is rejected before command execution", async () => {
  const slaHome = await createTempSlaHome();
  await fs.mkdir(slaHome, { recursive: true });
  await fs.writeFile(
    path.join(slaHome, "config.json"),
    `${JSON.stringify({ schemaVersion: 999, defaultProfile: "default", hosts: {} }, null, 2)}\n`,
    "utf8",
  );

  const result = run(["profile", "list"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SCHEMA_MIGRATION_REQUIRED/);
});

test("creates and lists named profiles", async () => {
  const slaHome = await createInstalledSlaHome();

  const created = run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  assert.equal(created.status, 0);
  assert.match(created.stdout, /Created profile 'research'/);

  await assertPathExists(path.join(slaHome, "research", "SOUL.md"));
  await assertPathExists(path.join(slaHome, "research", "memories", "MEMORY.md"));
  await assertPathExists(path.join(slaHome, "research", "memories", "USER.md"));
  await assertPathExists(path.join(slaHome, "research", "skills", ".usage.json"));

  const listed = run(["profile", "list", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(listed.status, 0);

  const parsed = JSON.parse(listed.stdout);
  assert.deepEqual(parsed, {
    ok: true,
    data: {
      profiles: [
        {
          name: "default",
          path: path.join(slaHome, "default"),
          isDefault: true,
        },
        {
          name: "research",
          path: path.join(slaHome, "research"),
          isDefault: false,
        },
      ],
      defaultProfile: "default",
    },
  });
});

test("lists Hermes profiles from profiles/ only", async () => {
  const hermesHome = await createInstalledHermesHome();
  await fs.mkdir(path.join(hermesHome, "scratch"), { recursive: true });

  const created = runHermes(["profile", "create", "research"], { env: { SLA_HOME: hermesHome } });
  assert.equal(created.status, 0);

  const listed = runHermes(["profile", "list", "--json"], { env: { SLA_HOME: hermesHome } });
  assert.equal(listed.status, 0);

  const parsed = JSON.parse(listed.stdout);
  assert.deepEqual(parsed.data, {
    profiles: [
      {
        name: "default",
        path: path.join(hermesHome, "profiles", "default"),
        isDefault: true,
      },
      {
        name: "research",
        path: path.join(hermesHome, "profiles", "research"),
        isDefault: false,
      },
    ],
    defaultProfile: "default",
  });
});

test("returns profile directory using explicit or default resolution", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const explicitResult = run(["profile", "dir", "research"], { env: { SLA_HOME: slaHome } });
  assert.equal(explicitResult.status, 0);
  assert.equal(explicitResult.stdout.trim(), path.join(slaHome, "research"));

  const defaultResult = run(["profile", "dir"], { env: { SLA_HOME: slaHome } });
  assert.equal(defaultResult.status, 0);
  assert.equal(defaultResult.stdout.trim(), path.join(slaHome, "default"));
});

test("returns canonical profile context for empty and populated profiles", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["soul", "edit", "research", "--stdin"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nResearch profile for delivery API work.\n",
  });
  run(["memory", "add", "research", "--target", "memory", "--entry", "The API runs in us-east-1"], {
    env: { SLA_HOME: slaHome },
  });
  run(["memory", "add", "research", "--target", "user", "--entry", "Prefers concise updates"], {
    env: { SLA_HOME: slaHome },
  });
  run(["skill", "create", "deploy", "research"], { env: { SLA_HOME: slaHome } });
  run(["skill", "view", "deploy", "research"], { env: { SLA_HOME: slaHome } });
  const activeAdd = run(
    ["active-context", "add", "research", "--entry", "Incident bridge remains active", "--expires-at", "2099-01-01T00:00:00Z", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(activeAdd.status, 0, activeAdd.stderr);
  const expiredAdd = run(
    ["active-context", "add", "research", "--entry", "Retired incident bridge", "--expires-at", "2000-01-01T00:00:00Z", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(expiredAdd.status, 0, expiredAdd.stderr);

  const result = run(["profile", "context", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.profile, "research");
  assert.equal(parsed.data.profilePath, path.join(slaHome, "research"));
  assert.equal(parsed.data.soul.raw, "# SOUL\n\nResearch profile for delivery API work.\n");
  assert.deepEqual(parsed.data.memories.memory.entries, ["The API runs in us-east-1"]);
  assert.deepEqual(parsed.data.memories.user.entries, ["Prefers concise updates"]);
  assert.equal(parsed.data.skills.count, 1);
  assert.equal(parsed.data.skills.index[0].skill, "deploy");
  assert.equal(parsed.data.skills.index[0].usage.viewCount, 1);
  assert.equal(parsed.data.operationalContext.entryCount, 1);
  assert.equal(parsed.data.operationalContext.entries[0].content, "Incident bridge remains active");
  assert.match(parsed.data.renderedContext, /## SOUL/);
  assert.match(parsed.data.renderedContext, /## MEMORY/);
  assert.match(parsed.data.renderedContext, /## USER/);
  assert.match(parsed.data.renderedContext, /## SKILL INDEX/);
  assert.match(parsed.data.renderedContext, /## EXPIRING OPERATIONAL CONTEXT/);
  assert.match(parsed.data.renderedContext, /temporary, advisory operational context/);
  assert.match(parsed.data.renderedContext, /Incident bridge remains active/);
  assert.doesNotMatch(parsed.data.renderedContext, /Retired incident bridge/);
  assert.ok(parsed.data.renderedContext.indexOf("## SOUL") < parsed.data.renderedContext.indexOf("## MEMORY"));
  assert.ok(parsed.data.renderedContext.indexOf("## MEMORY") < parsed.data.renderedContext.indexOf("## USER"));
  assert.ok(parsed.data.renderedContext.indexOf("## USER") < parsed.data.renderedContext.indexOf("## SKILL INDEX"));
  assert.ok(parsed.data.renderedContext.indexOf("## SKILL INDEX") < parsed.data.renderedContext.indexOf("## EXPIRING OPERATIONAL CONTEXT"));

  const textResult = run(["profile", "context", "research"], { env: { SLA_HOME: slaHome } });
  assert.equal(textResult.status, 0, textResult.stderr);
  assert.match(textResult.stdout, /## EXPIRING OPERATIONAL CONTEXT/);
  assert.match(textResult.stdout, /Incident bridge remains active/);
  assert.doesNotMatch(textResult.stdout, /Retired incident bridge/);

  const absent = run(["profile", "context", "default", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(absent.status, 0, absent.stderr);
  const absentParsed = JSON.parse(absent.stdout);
  assert.deepEqual(absentParsed.data.operationalContext, { entryCount: 0, entries: [] });
  assert.match(absentParsed.data.renderedContext, /\(no active entries\)/);

  const malformedStorePath = path.join(slaHome, "default", "operational-context", "entries.json");
  await fs.mkdir(path.dirname(malformedStorePath), { recursive: true });
  await fs.writeFile(malformedStorePath, "not-json", "utf8");
  const malformed = run(["profile", "context", "default", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(malformed.status, 1);
  assert.equal(JSON.parse(malformed.stdout).error.code, "OPERATIONAL_CONTEXT_STORE_INVALID");
});

test("classifies candidate profile knowledge from stdin", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const memoryResult = run(["profile", "classify", "research", "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "The API runs in us-east-1.\n",
  });
  assert.equal(memoryResult.status, 0);
  assert.equal(JSON.parse(memoryResult.stdout).data.classification, "memory");

  const userResult = run(["profile", "classify", "research", "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "User prefers concise updates.\n",
  });
  assert.equal(userResult.status, 0);
  assert.equal(JSON.parse(userResult.stdout).data.classification, "user");

  const skillResult = run(["profile", "classify", "research", "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "Deploy workflow\n1. Build the image\n2. Push to ECR\n3. Restart the service\n",
  });
  assert.equal(skillResult.status, 0);
  const skillParsed = JSON.parse(skillResult.stdout);
  assert.equal(skillParsed.data.classification, "skill");
  assert.equal(skillParsed.data.recommendedTarget, "skill");
  assert.equal(skillParsed.data.recommendedSkillName, "deploy-workflow");

  const noneResult = run(["profile", "classify", "research", "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "Todo for today: debug this specific failure and follow up.\n",
  });
  assert.equal(noneResult.status, 0);
  assert.equal(JSON.parse(noneResult.stdout).data.classification, "none");

  const operationalResult = run(
    ["profile", "classify", "research", "--stdin", "--expires-at", "2026-12-01T00:00:00Z", "--json"],
    {
      env: { SLA_HOME: slaHome },
      input: "Temporary incident bridge instructions for today.\n",
    },
  );
  assert.equal(operationalResult.status, 0);
  const operationalParsed = JSON.parse(operationalResult.stdout);
  assert.equal(operationalParsed.data.classification, "operational-context");
  assert.equal(operationalParsed.data.recommendedTarget, "operational-context");
  assert.equal(operationalParsed.data.lifecycle.expiresAt, "2026-12-01T00:00:00.000Z");

  const lifecycleQualifiedBridge = run(
    ["profile", "classify", "research", "--stdin", "--resolution-condition", "The release bridge is closed.", "--json"],
    {
      env: { SLA_HOME: slaHome },
      input: "The SLA E2E deployment bridge remains open.\n",
    },
  );
  assert.equal(lifecycleQualifiedBridge.status, 0);
  assert.equal(JSON.parse(lifecycleQualifiedBridge.stdout).data.classification, "memory");
});

test("manages profile-scoped lifecycle-qualified operational context without changing durable stores", async () => {
  const slaHome = await createInstalledSlaHome();
  const env = { SLA_HOME: slaHome };
  run(["profile", "create", "research"], { env });
  const durablePaths = [
    path.join(slaHome, "research", "memories", "MEMORY.md"),
    path.join(slaHome, "research", "memories", "USER.md"),
    path.join(slaHome, "research", "skills", ".usage.json"),
  ];
  const durableBefore = await Promise.all(durablePaths.map((entry) => fs.readFile(entry, "utf8")));

  const expiryAdd = run(
    ["active-context", "add", "research", "--entry", "Incident bridge remains active", "--expires-at", "2026-12-01T00:00:00Z", "--json"],
    { env },
  );
  assert.equal(expiryAdd.status, 0, expiryAdd.stderr);
  const expiryEntry = JSON.parse(expiryAdd.stdout).data.entry;
  assert.match(expiryEntry.id, /^[0-9a-f-]{36}$/);
  assert.equal(expiryEntry.expiresAt, "2026-12-01T00:00:00.000Z");
  assert.equal(expiryEntry.resolutionCondition, undefined);

  const conditionAdd = run(
    ["active-context", "add", "research", "--entry", "Use migration mapping", "--resolution-condition", "Production migration completes", "--json"],
    { env },
  );
  assert.equal(conditionAdd.status, 0, conditionAdd.stderr);
  const conditionEntry = JSON.parse(conditionAdd.stdout).data.entry;

  const bothAdd = run(
    ["active-context", "add", "research", "--entry", "Rollback owner is on call", "--expires-at", "2026-12-02T00:00:00Z", "--resolution-condition", "Rollback is cancelled", "--json"],
    { env },
  );
  assert.equal(bothAdd.status, 0, bothAdd.stderr);

  const listed = run(["active-context", "list", "research", "--json"], { env });
  assert.equal(listed.status, 0);
  assert.equal(JSON.parse(listed.stdout).data.entryCount, 3);

  const viewed = run(["active-context", "view", "research", "--id", conditionEntry.id, "--json"], { env });
  assert.equal(viewed.status, 0);
  assert.deepEqual(JSON.parse(viewed.stdout).data.entry, conditionEntry);

  const otherProfile = run(["active-context", "list", "default", "--json"], { env });
  assert.equal(otherProfile.status, 0);
  assert.deepEqual(JSON.parse(otherProfile.stdout).data.entries, []);

  const durableAfter = await Promise.all(durablePaths.map((entry) => fs.readFile(entry, "utf8")));
  assert.deepEqual(durableAfter, durableBefore);
  const store = JSON.parse(await fs.readFile(path.join(slaHome, "research", "operational-context", "entries.json"), "utf8"));
  assert.equal(store.schemaVersion, 1);
  assert.equal(store.entries.length, 3);

  const removed = run(["active-context", "resolve", "research", "--id", conditionEntry.id, "--json"], { env });
  assert.equal(removed.status, 0);
  assert.equal(JSON.parse(removed.stdout).data.removedEntry.id, conditionEntry.id);
});

test("rejects invalid, duplicate, unknown, and cross-profile operational-context operations without writes", async () => {
  const slaHome = await createInstalledSlaHome();
  const env = { SLA_HOME: slaHome };
  run(["profile", "create", "research"], { env });
  const researchStorePath = path.join(slaHome, "research", "operational-context", "entries.json");

  const invalid = run(["active-context", "add", "research", "--entry", "Temporary note", "--json"], { env });
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).error.code, "OPERATIONAL_CONTEXT_LIFECYCLE_REQUIRED");
  await assertPathMissing(researchStorePath);

  const unknown = run(["active-context", "remove", "research", "--id", "missing", "--json"], { env });
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).error.code, "OPERATIONAL_CONTEXT_ENTRY_NOT_FOUND");
  await assertPathMissing(path.join(slaHome, "research", "operational-context"));

  const first = run(
    ["active-context", "add", "research", "--entry", "Temporary note", "--resolution-condition", "Release completes", "--json"],
    { env },
  );
  assert.equal(first.status, 0);
  const beforeDuplicate = await fs.readFile(researchStorePath, "utf8");
  const duplicate = run(
    ["active-context", "add", "research", "--entry", "Temporary note", "--resolution-condition", "Release completes", "--json"],
    { env },
  );
  assert.equal(duplicate.status, 2);
  assert.equal(JSON.parse(duplicate.stdout).error.code, "OPERATIONAL_CONTEXT_ENTRY_ALREADY_EXISTS");
  assert.equal(await fs.readFile(researchStorePath, "utf8"), beforeDuplicate);

  const crossProfile = run(["active-context", "remove", "default", "--id", JSON.parse(first.stdout).data.entry.id, "--json"], { env });
  assert.equal(crossProfile.status, 1);
  assert.equal(JSON.parse(crossProfile.stdout).error.code, "OPERATIONAL_CONTEXT_ENTRY_NOT_FOUND");
  assert.equal(await fs.readFile(researchStorePath, "utf8"), beforeDuplicate);
});

test("operational-context discovery is backward compatible and reports malformed stores safely", async () => {
  const slaHome = await createInstalledSlaHome();
  const env = { SLA_HOME: slaHome };
  const legacyDurableStore = path.join(slaHome, "default", "memories", "MEMORY.md");
  const durableBefore = await fs.readFile(legacyDurableStore, "utf8");
  const empty = run(["active-context", "list", "default", "--json"], { env });
  assert.equal(empty.status, 0);
  assert.deepEqual(JSON.parse(empty.stdout).data.entries, []);
  assert.equal(await fs.readFile(legacyDurableStore, "utf8"), durableBefore);

  const storePath = path.join(slaHome, "default", "operational-context", "entries.json");
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, "not-json", "utf8");
  const malformed = run(["active-context", "list", "default", "--json"], { env });
  assert.equal(malformed.status, 1);
  assert.equal(JSON.parse(malformed.stdout).error.code, "OPERATIONAL_CONTEXT_STORE_INVALID");
  assert.equal(await fs.readFile(storePath, "utf8"), "not-json");
});

test("operational-context atomic write failures leave no partial or durable-store mutation", async () => {
  const slaHome = await createInstalledSlaHome();
  const originalSlaHome = process.env.SLA_HOME;
  const storePath = path.join(slaHome, "default", "operational-context", "entries.json");
  const durableStorePath = path.join(slaHome, "default", "memories", "MEMORY.md");
  const durableBefore = await fs.readFile(durableStorePath, "utf8");
  const originalWriteFileAtomic = filesystem.writeFileAtomic;

  try {
    process.env.SLA_HOME = slaHome;
    filesystem.writeFileAtomic = async () => {
      throw new Error("simulated atomic-write failure");
    };
    await assert.rejects(
      operationalContext.addOperationalContext("default", {
        content: "Temporary incident bridge note",
        resolutionCondition: "Incident is resolved",
      }),
      /simulated atomic-write failure/,
    );
  } finally {
    filesystem.writeFileAtomic = originalWriteFileAtomic;
    if (originalSlaHome === undefined) {
      delete process.env.SLA_HOME;
    } else {
      process.env.SLA_HOME = originalSlaHome;
    }
  }

  await assertPathMissing(storePath);
  await assertPathMissing(`${storePath}.lock`);
  assert.equal(await fs.readFile(durableStorePath, "utf8"), durableBefore);
});

test("sets and gets the default profile", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const setDefaultResult = run(["profile", "set-default", "research", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(setDefaultResult.status, 0);

  const setDefaultParsed = JSON.parse(setDefaultResult.stdout);
  assert.equal(setDefaultParsed.ok, true);
  assert.equal(setDefaultParsed.data.defaultProfile, "research");

  const getDefaultResult = run(["profile", "get-default"], { env: { SLA_HOME: slaHome } });
  assert.equal(getDefaultResult.status, 0);
  assert.equal(getDefaultResult.stdout.trim(), "research");

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.defaultProfile, "research");
});

test("refuses to delete the current default profile", async () => {
  const slaHome = await createInstalledSlaHome();

  const result = run(["profile", "delete", "default", "--yes"], { env: { SLA_HOME: slaHome } });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEFAULT_PROFILE_DELETE_FORBIDDEN/);
  await assertPathExists(path.join(slaHome, "default"));
});

test("deletes a non-default profile with explicit confirmation", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const result = run(["profile", "delete", "research", "--yes", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.deletedProfile, "research");

  await assert.rejects(fs.access(path.join(slaHome, "research")));
});

test("views and edits soul content from file and stdin", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const initialView = run(["soul", "view", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(initialView.status, 0);
  assert.deepEqual(JSON.parse(initialView.stdout), {
    ok: true,
    data: {
      profile: "research",
      path: path.join(slaHome, "research", "SOUL.md"),
      raw: "# SOUL\n",
    },
  });

  const sourcePath = path.join(slaHome, "next-soul.md");
  await fs.writeFile(sourcePath, "# SOUL\n\nResearch profile for infrastructure work.\n", "utf8");

  const fileEdit = run(["soul", "edit", "research", "--file", sourcePath], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(fileEdit.status, 0);
  assert.match(fileEdit.stdout, /Updated SOUL\.md for profile 'research'/);

  const stdinEdit = run(["soul", "edit", "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nDefault profile for quick notes.\n",
  });
  assert.equal(stdinEdit.status, 0);
  const stdinParsed = JSON.parse(stdinEdit.stdout);
  assert.equal(stdinParsed.ok, true);
  assert.equal(stdinParsed.data.profile, "default");
  assert.equal(stdinParsed.data.source, "stdin");
  assert.equal(stdinParsed.data.raw, "# SOUL\n\nDefault profile for quick notes.\n");

  const researchSoul = await fs.readFile(path.join(slaHome, "research", "SOUL.md"), "utf8");
  assert.equal(researchSoul, "# SOUL\n\nResearch profile for infrastructure work.\n");

  const defaultSoul = await fs.readFile(path.join(slaHome, "default", "SOUL.md"), "utf8");
  assert.equal(defaultSoul, "# SOUL\n\nDefault profile for quick notes.\n");
});

test("requires exactly one soul edit input source", async () => {
  const slaHome = await createInstalledSlaHome();
  const sourcePath = path.join(slaHome, "next-soul.md");
  await fs.writeFile(sourcePath, "# SOUL\n\nProfile.\n", "utf8");

  const missingInput = run(["soul", "edit", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(missingInput.status, 2);
  assert.equal(JSON.parse(missingInput.stdout).error.code, "INVALID_SOUL_INPUT");

  const duplicateInput = run(["soul", "edit", "--file", sourcePath, "--stdin", "--json"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nConflicting input.\n",
  });
  assert.equal(duplicateInput.status, 2);
  assert.equal(JSON.parse(duplicateInput.stdout).error.code, "INVALID_SOUL_INPUT");
});

test("adds, lists, views, replaces, and removes memory entries", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const addMemory = run(
    ["memory", "add", "research", "--target", "memory", "--entry", "Postgres runs locally"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(addMemory.status, 0);

  const addUser = run(
    ["memory", "add", "--target", "user", "--entry", "Prefers concise answers"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(addUser.status, 0);

  const listed = run(["memory", "list", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(listed.status, 0);
  assert.deepEqual(JSON.parse(listed.stdout), {
    ok: true,
    data: {
      profile: "research",
      targets: [
        {
          target: "memory",
          entryCount: 1,
          entries: ["Postgres runs locally"],
        },
        {
          target: "user",
          entryCount: 0,
          entries: [],
        },
      ],
    },
  });

  const userView = run(["memory", "view", "--target", "user", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(userView.status, 0);
  const viewed = JSON.parse(userView.stdout);
  assert.equal(viewed.ok, true);
  assert.equal(viewed.data.profile, "default");
  assert.equal(viewed.data.target, "user");
  assert.deepEqual(viewed.data.entries, ["Prefers concise answers"]);
  assert.match(viewed.data.raw, /^# USER\n\nPrefers concise answers\n$/);

  const replaceResult = run(
    ["memory", "replace", "--target", "user", "--match", "concise", "--entry", "Prefers detailed answers"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(replaceResult.status, 0);

  const removeResult = run(
    ["memory", "remove", "--target", "user", "--match", "detailed"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(removeResult.status, 0);

  const usage = JSON.parse(
    await fs.readFile(path.join(slaHome, "default", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.memory.lastModifiedTarget, "user");
  assert.equal(usage.memory.lastOperation, "remove");
  assert.equal(usage.memory.targets.user.entryCount, 0);
  assert.ok(usage.memory.lastOperationAt);
});

test("rejects duplicate memory entries", async () => {
  const slaHome = await createInstalledSlaHome();

  const first = run(
    ["memory", "add", "--target", "memory", "--entry", "The API runs in us-east-1"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(first.status, 0);

  const duplicate = run(
    ["memory", "add", "--target", "memory", "--entry", "The API runs in us-east-1", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(duplicate.status, 2);

  const parsed = JSON.parse(duplicate.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "MEMORY_ENTRY_ALREADY_EXISTS");
});

test("fails explicitly when memory matches are missing or ambiguous", async () => {
  const slaHome = await createInstalledSlaHome();

  run(["memory", "add", "--target", "memory", "--entry", "Primary API endpoint"], {
    env: { SLA_HOME: slaHome },
  });
  run(["memory", "add", "--target", "memory", "--entry", "Primary API token"], {
    env: { SLA_HOME: slaHome },
  });

  const ambiguous = run(
    ["memory", "replace", "--target", "memory", "--match", "Primary API", "--entry", "Updated"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /MEMORY_ENTRY_AMBIGUOUS/);

  const missing = run(
    ["memory", "remove", "--target", "memory", "--match", "does not exist", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(missing.status, 1);
  const parsed = JSON.parse(missing.stdout);
  assert.equal(parsed.error.code, "MEMORY_ENTRY_NOT_FOUND");
});

test("creates, lists, views, edits, and deletes skills", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const created = run(["skill", "create", "deploy", "research", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(created.status, 0);
  const createdParsed = JSON.parse(created.stdout);
  assert.equal(createdParsed.ok, true);
  assert.equal(createdParsed.data.skill, "deploy");
  assert.equal(createdParsed.data.metadata.name, "deploy");
  await assertPathExists(path.join(slaHome, "research", "skills", "deploy", "references"));
  await assertPathExists(path.join(slaHome, "research", "skills", "deploy", "templates"));
  await assertPathExists(path.join(slaHome, "research", "skills", "deploy", "scripts"));
  await assertPathExists(path.join(slaHome, "research", "skills", "deploy", "assets"));

  const listed = run(["skill", "list", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(listed.status, 0);
  const listedParsed = JSON.parse(listed.stdout);
  assert.equal(listedParsed.ok, true);
  assert.equal(listedParsed.data.profile, "research");
  assert.equal(listedParsed.data.skills.length, 1);
  assert.equal(listedParsed.data.skills[0].skill, "deploy");
  assert.equal(listedParsed.data.skills[0].name, "deploy");
  assert.equal(listedParsed.data.skills[0].description, "TODO: describe this skill.");
  assert.equal(listedParsed.data.skills[0].path, path.join(slaHome, "research", "skills", "deploy", "SKILL.md"));
  assert.equal(listedParsed.data.skills[0].usage.viewCount, 0);
  assert.equal(listedParsed.data.skills[0].usage.editCount, 1);
  assert.equal(listedParsed.data.skills[0].usage.useCount, 0);
  assert.equal(listedParsed.data.skills[0].usage.lastOperation, "edit");
  assert.ok(listedParsed.data.skills[0].usage.lastEditedAt);
  assert.ok(listedParsed.data.skills[0].usage.lastActivityAt);

  const viewed = run(["skill", "view", "deploy", "research", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(viewed.status, 0);
  const viewedParsed = JSON.parse(viewed.stdout);
  assert.equal(viewedParsed.ok, true);
  assert.equal(viewedParsed.data.metadata.name, "deploy");
  assert.match(viewedParsed.data.raw, /^---\nname: deploy\n/);

  const nextSkillPath = path.join(slaHome, "deploy-skill.md");
  await fs.writeFile(
    nextSkillPath,
    ["---", "name: deploy", "description: Deploys the API.", "---", "", "# Deploy", "", "Run the release flow.", ""].join("\n"),
    "utf8",
  );

  const edited = run(["skill", "edit", "deploy", "research", "--file", nextSkillPath], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(edited.status, 0);
  assert.match(edited.stdout, /Updated SKILL\.md/);

  const deleted = run(["skill", "delete", "deploy", "research", "--yes", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(deleted.status, 0);
  const deletedParsed = JSON.parse(deleted.stdout);
  assert.equal(deletedParsed.ok, true);
  assert.equal(deletedParsed.data.deletedSkill, "deploy");

  await assert.rejects(fs.access(path.join(slaHome, "research", "skills", "deploy", "SKILL.md")));

  const usage = JSON.parse(
    await fs.readFile(path.join(slaHome, "research", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.skills.deploy, undefined);
});

test("creates skill reference markdown files and generated scaffolds", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });

  const generated = run(
    ["skill", "create-reference", "deploy", "--path", "release-flow.md", "--title", "Release Flow", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(generated.status, 0);
  const generatedParsed = JSON.parse(generated.stdout);
  assert.equal(generatedParsed.ok, true);
  assert.equal(generatedParsed.data.path, "references/release-flow.md");
  assert.equal(generatedParsed.data.title, "Release Flow");
  assert.equal(generatedParsed.data.source, "generated");
  assert.match(
    await fs.readFile(path.join(slaHome, "default", "skills", "deploy", "references", "release-flow.md"), "utf8"),
    /^# Release Flow\n\nReference document for the `deploy` skill\./,
  );

  const customReferencePath = path.join(slaHome, "incident-analysis.md");
  await fs.writeFile(customReferencePath, "# Incident Analysis\n\nRoot cause details.\n", "utf8");

  const fromFile = run(
    ["skill", "create-reference", "deploy", "--path", "incident-analysis.md", "--file", customReferencePath, "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(fromFile.status, 0);
  const fromFileParsed = JSON.parse(fromFile.stdout);
  assert.equal(fromFileParsed.data.path, "references/incident-analysis.md");
  assert.equal(fromFileParsed.data.title, "Incident Analysis");
  assert.equal(fromFileParsed.data.source, "file");
  assert.equal(
    await fs.readFile(path.join(slaHome, "default", "skills", "deploy", "references", "incident-analysis.md"), "utf8"),
    "# Incident Analysis\n\nRoot cause details.\n",
  );
});

test("writes and removes managed skill files in allowed subdirectories", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });

  const scriptPath = path.join(slaHome, "check.sh");
  await fs.writeFile(scriptPath, "#!/bin/sh\necho ok\n", "utf8");

  const wrote = run(
    ["skill", "write-file", "deploy", "--subdir", "scripts", "--path", "check.sh", "--file", scriptPath, "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(wrote.status, 0);
  const wroteParsed = JSON.parse(wrote.stdout);
  assert.equal(wroteParsed.ok, true);
  assert.equal(wroteParsed.data.path, "scripts/check.sh");

  const managedFile = path.join(slaHome, "default", "skills", "deploy", "scripts", "check.sh");
  assert.equal(await fs.readFile(managedFile, "utf8"), "#!/bin/sh\necho ok\n");

  const removed = run(["skill", "remove-file", "deploy", "--path", "scripts/check.sh", "--yes"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(removed.status, 0);
  await assert.rejects(fs.access(managedFile));

  const usage = JSON.parse(
    await fs.readFile(path.join(slaHome, "default", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.skills.deploy.editCount, 3);
  assert.equal(usage.skills.deploy.viewCount, 0);
  assert.ok(usage.skills.deploy.lastEditedAt);
});

test("Hermes skill storage defaults to general and keeps category usage distinct", async () => {
  const hermesHome = await createInstalledHermesHome();
  const env = { SLA_HOME: hermesHome };

  assert.equal(runHermes(["skill", "create", "deploy", "--json"], { env }).status, 0);
  assert.equal(runHermes(["skill", "create", "deploy", "--category", "ops", "--json"], { env }).status, 0);
  assert.equal(runHermes(["skill", "view", "deploy", "--json"], { env }).status, 0);
  assert.equal(runHermes(["skill", "view", "deploy", "--category", "ops", "--json"], { env }).status, 0);

  const listed = runHermes(["skill", "list", "--json"], { env });
  assert.equal(listed.status, 0);
  const listedParsed = JSON.parse(listed.stdout);
  assert.deepEqual(
    listedParsed.data.skills.map((entry) => ({
      skill: entry.skill,
      category: entry.category,
      path: entry.path,
      viewCount: entry.usage.viewCount,
    })),
    [
      {
        skill: "general/deploy",
        category: "general",
        path: path.join(hermesHome, "profiles", "default", "skills", "general", "deploy", "SKILL.md"),
        viewCount: 1,
      },
      {
        skill: "ops/deploy",
        category: "ops",
        path: path.join(hermesHome, "profiles", "default", "skills", "ops", "deploy", "SKILL.md"),
        viewCount: 1,
      },
    ],
  );

  const usage = JSON.parse(
    await fs.readFile(path.join(hermesHome, "profiles", "default", "skills", ".usage.json"), "utf8"),
  );
  assert.equal(usage.skills["general/deploy"].viewCount, 1);
  assert.equal(usage.skills["ops/deploy"].viewCount, 1);

  const context = runHermes(["profile", "context", "--json"], { env });
  assert.equal(context.status, 0);
  const contextParsed = JSON.parse(context.stdout);
  assert.equal(contextParsed.data.skills.index[0].skill, "general/deploy");
  assert.equal(contextParsed.data.skills.index[1].skill, "ops/deploy");
  assert.match(contextParsed.data.renderedContext, /general\/deploy/);
  assert.match(contextParsed.data.renderedContext, /ops\/deploy/);
});

test("rejects invalid skill frontmatter and unsafe managed paths", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });

  const invalidSkillPath = path.join(slaHome, "invalid-skill.md");
  await fs.writeFile(invalidSkillPath, "# Deploy\n\nMissing frontmatter.\n", "utf8");

  const invalidFrontmatter = run(["skill", "edit", "deploy", "--file", invalidSkillPath, "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(invalidFrontmatter.status, 2);
  assert.equal(JSON.parse(invalidFrontmatter.stdout).error.code, "INVALID_SKILL_FRONTMATTER");

  const unsafeWrite = run(
    ["skill", "write-file", "deploy", "--subdir", "scripts", "--path", "../check.sh", "--stdin", "--json"],
    {
      env: { SLA_HOME: slaHome },
      input: "echo bad\n",
    },
  );
  assert.equal(unsafeWrite.status, 2);
  assert.equal(JSON.parse(unsafeWrite.stdout).error.code, "INVALID_MANAGED_PATH");

  const unsafeRemove = run(["skill", "remove-file", "deploy", "--path", "SKILL.md", "--yes", "--json"], {
    env: { SLA_HOME: slaHome },
  });
  assert.equal(unsafeRemove.status, 2);
  assert.equal(JSON.parse(unsafeRemove.stdout).error.code, "INVALID_SKILL_SUBDIR");

  const invalidReferencePath = run(
    ["skill", "create-reference", "deploy", "--path", "incident-analysis.txt", "--title", "Incident Analysis", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(invalidReferencePath.status, 2);
  assert.equal(JSON.parse(invalidReferencePath.stdout).error.code, "INVALID_SKILL_REFERENCE_PATH");

  const missingReferenceTitle = run(
    ["skill", "create-reference", "deploy", "--path", "incident-analysis.md", "--json"],
    { env: { SLA_HOME: slaHome } },
  );
  assert.equal(missingReferenceTitle.status, 2);
  assert.equal(JSON.parse(missingReferenceTitle.stdout).error.code, "INVALID_SKILL_REFERENCE_TITLE");
});

test("reports global stats across profiles", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["memory", "add", "--target", "memory", "--entry", "Default memory"], { env: { SLA_HOME: slaHome } });
  run(["memory", "add", "research", "--target", "user", "--entry", "Research preference"], {
    env: { SLA_HOME: slaHome },
  });
  run(["skill", "create", "deploy"], { env: { SLA_HOME: slaHome } });
  run(["skill", "create", "investigate", "research"], { env: { SLA_HOME: slaHome } });
  run(["skill", "view", "investigate", "research"], { env: { SLA_HOME: slaHome } });

  const result = run(["stats", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.profileCount, 2);
  assert.equal(parsed.data.defaultProfile, "default");
  assert.equal(parsed.data.totalMemories, 2);
  assert.equal(parsed.data.totalSkills, 2);
  assert.equal(parsed.data.latestActivity.profile, "research");
  assert.equal(parsed.data.latestActivity.kind, "skill");
  assert.equal(parsed.data.latestActivity.skill, "investigate");
  assert.equal(parsed.data.latestActivity.label, "skill:investigate");
  assert.ok(parsed.data.latestActivity.at);
});

test("reports per-profile stats with memory and skill activity", async () => {
  const slaHome = await createInstalledSlaHome();
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["memory", "add", "research", "--target", "memory", "--entry", "Research database"], {
    env: { SLA_HOME: slaHome },
  });
  run(["memory", "add", "research", "--target", "user", "--entry", "Prefers exact outputs"], {
    env: { SLA_HOME: slaHome },
  });
  run(["skill", "create", "deploy", "research"], { env: { SLA_HOME: slaHome } });
  run(["skill", "view", "deploy", "research"], { env: { SLA_HOME: slaHome } });

  const result = run(["stats", "profile", "research", "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.profile, "research");
  assert.equal(parsed.data.memories.memory.entryCount, 1);
  assert.equal(parsed.data.memories.user.entryCount, 1);
  assert.equal(parsed.data.memories.totalEntries, 2);
  assert.equal(parsed.data.memories.lastModified.target, "user");
  assert.equal(parsed.data.memories.lastModified.label, "memory:user");
  assert.equal(parsed.data.skills.count, 1);
  assert.equal(parsed.data.skills.lastModified.skill, "deploy");
  assert.equal(parsed.data.skills.lastModified.kind, "skill");
  assert.equal(parsed.data.lastActivity.skill, "deploy");
  assert.equal(parsed.data.lastWhat, "skill:deploy");
  assert.equal(parsed.data.telemetrySchemaVersion, 1);
  assert.ok(parsed.data.soul.modifiedAt);
});

test("records redacted persistence activity and de-duplicates a stable dispatch ID", async () => {
  const slaHome = await createInstalledSlaHome();
  const env = { SLA_HOME: slaHome };

  const recorded = run([
    "persistence", "record",
    "--profile", "default",
    "--outcome", "changed",
    "--memory", "1",
    "--event-id", "codex-dispatch-42",
    "--json",
  ], { env });
  assert.equal(recorded.status, 0, recorded.stderr);
  const first = JSON.parse(recorded.stdout);
  assert.equal(first.data.recorded, true);
  assert.equal(first.data.record.outcome, "changed");
  assert.deepEqual(first.data.record.profiles, ["default"]);
  assert.deepEqual(first.data.record.counts, { memory: 1, skills: 0, references: 0, operationalContext: 0 });
  assert.equal(first.data.record.failureReason, null);

  const duplicate = run([
    "persistence", "record",
    "--profile", "default",
    "--outcome", "changed",
    "--memory", "1",
    "--event-id", "codex-dispatch-42",
    "--json",
  ], { env });
  assert.equal(duplicate.status, 0, duplicate.stderr);
  assert.equal(JSON.parse(duplicate.stdout).data.recorded, false);

  const unsafeEventId = "stop:1:/Users/example/.codex/hooks.json";
  const unsafeRecorded = run([
    "persistence", "record",
    "--profile", "default",
    "--outcome", "changed",
    "--operational-context", "1",
    "--event-id", unsafeEventId,
    "--json",
  ], { env });
  assert.equal(unsafeRecorded.status, 0, unsafeRecorded.stderr);
  const unsafeRecord = JSON.parse(unsafeRecorded.stdout).data.record;
  assert.equal(unsafeRecord.eventId, "sha256:2e146bb929f264e99230f65d54243620ba82afa23176c30f41a5d9394d126612");
  assert.doesNotMatch(JSON.stringify(unsafeRecord), /\/Users\/example|hooks\.json/);

  const unsafeDuplicate = run([
    "persistence", "record",
    "--profile", "default",
    "--outcome", "changed",
    "--operational-context", "1",
    "--event-id", unsafeEventId,
    "--json",
  ], { env });
  assert.equal(unsafeDuplicate.status, 0, unsafeDuplicate.stderr);
  assert.equal(JSON.parse(unsafeDuplicate.stdout).data.recorded, false);

  const lifecycleRecorded = run([
    "persistence", "record",
    "--profile", "default",
    "--outcome", "changed",
    "--operational-context", "2",
    "--json",
  ], { env });
  assert.equal(lifecycleRecorded.status, 0, lifecycleRecorded.stderr);
  assert.equal(JSON.parse(lifecycleRecorded.stdout).data.record.counts.operationalContext, 2);

  const failed = run([
    "persistence", "record",
    "--outcome", "failed",
    "--failure-reason", "dispatch-unavailable",
    "--json",
  ], { env });
  assert.equal(failed.status, 0, failed.stderr);

  const activity = run(["persistence", "activity", "--json"], { env });
  assert.equal(activity.status, 0, activity.stderr);
  const records = JSON.parse(activity.stdout).data.records;
  assert.equal(records.length, 4);
  assert.equal(records[0].failureReason, "dispatch-unavailable");
  assert.equal(records[1].counts.operationalContext, 2);

  const activityFile = await fs.readFile(path.join(slaHome, "activity", "persistence.jsonl"), "utf8");
  assert.doesNotMatch(activityFile, /transcript|credential|secret|\/Users\/|hooks\.json|Incident bridge|resolution condition/i);

  const unsafeReason = run([
    "persistence", "record",
    "--outcome", "failed",
    "--failure-reason", "token=not-safe",
    "--json",
  ], { env });
  assert.equal(unsafeReason.status, 2);
  assert.equal(JSON.parse(unsafeReason.stdout).error.code, "INVALID_PERSISTENCE_FAILURE_REASON");
});

test("installs codex host wrappers and tracks installation metadata", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  const result = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.host, "codex");
  assert.equal(parsed.data.installPath, path.join(codexHome, "skills"));
  assert.equal(parsed.data.hookScope, "global");
  assert.equal(parsed.data.repositoryPath, null);
  assert.equal(parsed.data.hooksConfigPath, path.join(codexHome, "hooks.json"));
  assert.equal(parsed.data.stopHookPath, path.join(codexHome, "hooks", "sla-stop-hook.js"));
  assert.equal(parsed.data.sessionStartHookPath, path.join(codexHome, "hooks", "sla-session-start-hook.js"));
  assert.equal(parsed.data.persistenceReviewAgentPath, path.join(codexHome, "agents", "sla-persistence-review.toml"));
  assert.equal(parsed.data.persistenceActivityPath, path.join(slaHome, "activity", "persistence.jsonl"));
  assert.deepEqual(parsed.data.installedSkills, ["/use-profile", "/create-profile", "/update-profile"]);
  assert.equal(parsed.data.createdFiles.length, 10);
  assert.deepEqual(parsed.data.updatedFiles, []);
  assert.deepEqual(parsed.data.unchangedFiles, []);
  assert.ok(parsed.data.installedAt);

  const useProfileSkill = await fs.readFile(
    path.join(codexHome, "skills", "sla-use-profile", "SKILL.md"),
    "utf8",
  );
  assert.match(useProfileSkill, /sla profile dir <name>/);
  assert.match(useProfileSkill, /sla profile context <name> --json/);
  assert.match(useProfileSkill, /operationalContext/);
  assert.match(useProfileSkill, /temporary, advisory operational context/);
  assert.match(useProfileSkill, /sla memory add <profile> --target memory\|user --entry/);
  assert.match(useProfileSkill, /sla memory replace <profile> --target memory\|user --match/);
  assert.match(useProfileSkill, /sla memory remove <profile> --target memory\|user --match/);
  assert.match(useProfileSkill, /sla skill edit <skill> \[profile\] --file <SKILL\.md>/);
  assert.match(useProfileSkill, /Reusable operational knowledge belongs in `sla skill`/);
  assert.match(useProfileSkill, /Keep rich supporting context in `references\/\*\.md`/);
  assert.match(useProfileSkill, /Do not guess profile names/);

  const useProfileAgent = await fs.readFile(
    path.join(codexHome, "skills", "sla-use-profile", "agents", "openai.yaml"),
    "utf8",
  );
  assert.match(useProfileAgent, /display_name: "\/use-profile"/);

  const sessionStartScript = await fs.readFile(path.join(codexHome, "hooks", "sla-session-start-hook.js"), "utf8");
  assert.match(sessionStartScript, /session", "bootstrap"/);
  assert.match(sessionStartScript, /hookEventName: "SessionStart"/);
  assert.match(sessionStartScript, /skill index is not the full skill body/);
  assert.match(sessionStartScript, /active temporary advisory operational context/);

  const persistenceReviewAgent = await fs.readFile(
    path.join(codexHome, "agents", "sla-persistence-review.toml"),
    "utf8",
  );
  assert.match(persistenceReviewAgent, /^name = "sla-persistence-review"$/m);
  assert.match(persistenceReviewAgent, /Use only active profiles explicitly supplied in the parent session context/);
  assert.match(persistenceReviewAgent, /Never guess a profile or fall back to the SLA default/);
  assert.match(persistenceReviewAgent, /sla profile context <profile> --json/);
  assert.match(persistenceReviewAgent, /Use only `sla` CLI commands for SLA-managed reads and writes/);
  assert.match(persistenceReviewAgent, /sla memory add <profile> --target memory\|user --entry <text>/);
  assert.match(persistenceReviewAgent, /sla skill create <skill> <profile>/);
  assert.match(persistenceReviewAgent, /sla skill edit <skill> <profile> --stdin/);
  assert.match(persistenceReviewAgent, /sla skill create-reference <skill> <profile>/);
  assert.match(persistenceReviewAgent, /First assess each candidate yourself from the full forked snapshot/);
  assert.match(persistenceReviewAgent, /sla profile classify <profile> --stdin/);
  assert.ok(
    persistenceReviewAgent.indexOf("First assess each candidate yourself") <
      persistenceReviewAgent.indexOf("After your assessment, run `sla profile classify"),
  );
  assert.match(persistenceReviewAgent, /for every candidate you are considering for a persistence write/);
  assert.match(persistenceReviewAgent, /secondary safety check/);
  assert.match(persistenceReviewAgent, /may miss lifecycle-qualified operational context whose wording lacks temporary keywords/);
  assert.match(persistenceReviewAgent, /Do not silently treat a `memory`, `user`, or `skill` recommendation as automatic permission or automatic rejection/);
  assert.match(persistenceReviewAgent, /valid `--expires-at`, `--resolution-condition`, or both/);
  assert.match(persistenceReviewAgent, /sla active-context add <profile> --entry <text>/);
  assert.match(persistenceReviewAgent, /Agent assessment, valid lifecycle metadata, and a conservative secondary-check review are all required/);
  assert.match(persistenceReviewAgent, /sla active-context list <profile> --json/);
  assert.match(persistenceReviewAgent, /remove each expired entry with `sla active-context remove <profile> --id <entry-id>`/);
  assert.match(persistenceReviewAgent, /only against clear evidence in this forked session snapshot/);
  assert.match(persistenceReviewAgent, /If evidence is unclear, incomplete, inferred, or belongs to another profile, retain the entry/);
  assert.match(persistenceReviewAgent, /Skip an exact or materially duplicate active entry/);
  assert.match(persistenceReviewAgent, /If several active profiles exist, route each candidate only to the profile it is specific to/);
  assert.match(persistenceReviewAgent, /If the target remains ambiguous, skip that candidate/);
  assert.match(persistenceReviewAgent, /Skip exact or materially duplicate content/);
  assert.match(persistenceReviewAgent, /temporary next step, raw transcript material, or secret/);
  assert.match(persistenceReviewAgent, /If a CLI write fails, do not retry blindly/);
  assert.match(persistenceReviewAgent, /Do not announce that you are starting, dispatching, reviewing, or finishing/);
  assert.match(persistenceReviewAgent, /sla persistence record/);
  assert.match(persistenceReviewAgent, /Count active-context adds, expired-entry pruning, and clearly resolved entries only with `--operational-context <count>`/);
  assert.match(persistenceReviewAgent, /SLA deterministically redacts unsafe identifiers before storage/);
  assert.match(persistenceReviewAgent, /Never place entry content, resolution conditions, transcript text, secrets, paths, or an arbitrary error message in the activity record/);
  assert.match(persistenceReviewAgent, /memory=<count>; skills=<count>; references=<count>; operational-context=<count>/);
  assert.match(persistenceReviewAgent, /no-change/);
  assert.match(persistenceReviewAgent, /failed: <safe reason>/);

  const hooksConfig = JSON.parse(await fs.readFile(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(Array.isArray(hooksConfig.hooks.SessionStart), true);
  assert.equal(hooksConfig.hooks.Stop[0].hooks[0].command, "node " + JSON.stringify(path.join(codexHome, "hooks", "sla-stop-hook.js")));
  assert.equal(hooksConfig.hooks.SessionStart[0].matcher, "startup|resume|clear|compact");
  assert.equal(hooksConfig.hooks.SessionStart[0].hooks[0].type, "command");
  assert.equal(
    hooksConfig.hooks.SessionStart[0].hooks[0].command,
    "node " + JSON.stringify(path.join(codexHome, "hooks", "sla-session-start-hook.js")),
  );

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.hosts.codex.installed, true);
  assert.equal(config.hosts.codex.installPath, path.join(codexHome, "skills"));
  assert.equal(config.hosts.codex.hooksConfigPath, path.join(codexHome, "hooks.json"));
  assert.equal(config.hosts.codex.stopHookPath, path.join(codexHome, "hooks", "sla-stop-hook.js"));
  assert.equal(config.hosts.codex.sessionStartHookPath, path.join(codexHome, "hooks", "sla-session-start-hook.js"));
  assert.equal(config.hosts.codex.persistenceReviewAgentPath, path.join(codexHome, "agents", "sla-persistence-review.toml"));
  assert.equal(config.hosts.codex.persistenceActivityPath, path.join(slaHome, "activity", "persistence.jsonl"));
  assert.equal(config.hosts.codex.hookScope, "global");
  assert.equal(config.hosts.codex.repositoryPath, null);
  assert.deepEqual(config.hosts.codex.installedSkills, [
    "/use-profile",
    "/create-profile",
    "/update-profile",
  ]);
  assert.ok(config.hosts.codex.installedAt);
});

test("rerunning codex host install is idempotent and host list reports status", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const claudeHome = await fs.mkdtemp(path.join(os.tmpdir(), "claude-test-"));
  const env = { SLA_HOME: slaHome, CODEX_HOME: codexHome, CLAUDE_CONFIG_DIR: claudeHome };

  const first = run(["host", "install", "codex", "--json"], {
    env,
  });
  assert.equal(first.status, 0);

  const blocked = run(["host", "install", "codex", "--json"], {
    env,
  });
  assert.equal(blocked.status, 1);
  const blockedParsed = JSON.parse(blocked.stdout);
  assert.equal(blockedParsed.ok, false);
  assert.equal(blockedParsed.error.code, "HOST_INSTALL_OVERWRITE_REQUIRED");

  const second = run(["host", "install", "codex", "--yes", "--json"], {
    env,
  });
  assert.equal(second.status, 0);

  const secondParsed = JSON.parse(second.stdout);
  assert.equal(secondParsed.ok, true);
  assert.deepEqual(secondParsed.data.createdFiles, []);
  assert.deepEqual(secondParsed.data.updatedFiles, []);
  assert.equal(secondParsed.data.unchangedFiles.length, 10);

  const listed = run(["host", "list", "--json"], {
    env,
  });
  assert.equal(listed.status, 0);

  const listedParsed = JSON.parse(listed.stdout);
  assert.deepEqual(listedParsed.data.hosts[0], {
    host: "codex",
    available: true,
    installed: true,
    installPath: path.join(codexHome, "skills"),
    hooksConfigPath: path.join(codexHome, "hooks.json"),
    stopHookPath: path.join(codexHome, "hooks", "sla-stop-hook.js"),
    sessionStartHookPath: path.join(codexHome, "hooks", "sla-session-start-hook.js"),
    persistenceReviewAgentPath: path.join(codexHome, "agents", "sla-persistence-review.toml"),
    persistenceActivityPath: path.join(slaHome, "activity", "persistence.jsonl"),
    hookScope: "global",
    repositoryPath: null,
    installedSkills: ["/use-profile", "/create-profile", "/update-profile"],
    installedAt: listedParsed.data.hosts[0].installedAt,
  });
  assert.deepEqual(listedParsed.data.hosts[1], {
    host: "claude",
    available: true,
    installed: false,
    installPath: null,
    hooksConfigPath: null,
    stopHookPath: null,
    sessionStartHookPath: null,
    persistenceReviewStartHookPath: null,
    persistenceReviewAgentPath: null,
    persistenceActivityPath: path.join(slaHome, "activity", "persistence.jsonl"),
    hookScope: null,
    repositoryPath: null,
    installedSkills: ["/use-profile", "/create-profile", "/update-profile"],
    installedAt: null,
  });
  assert.deepEqual(listedParsed.data.hosts[2], {
    host: "cursor",
    available: true,
    installed: false,
    installPath: null,
    hooksConfigPath: null,
    stopHookPath: null,
    hookScope: null,
    repositoryPath: null,
    installedSkills: ["/use-profile", "/create-profile", "/update-profile"],
    installedAt: null,
  });
  assert.deepEqual(listedParsed.data.hosts[3], {
    host: "hermes",
    available: true,
    installed: false,
    installPath: null,
    hooksConfigPath: null,
    stopHookPath: null,
    hookScope: null,
    repositoryPath: null,
    profile: null,
    installedSkills: ["/use-profile", "/create-profile", "/update-profile"],
    installedAt: null,
  });
  assert.deepEqual(listedParsed.ok, true);
  assert.ok(listedParsed.data.hosts[0].installedAt);
});

test("installs Claude Code lifecycle hooks and persistence-review child without changing unrelated settings", async () => {
  const slaHome = await createInstalledSlaHome();
  const claudeHome = await fs.mkdtemp(path.join(os.tmpdir(), "claude-test-"));
  await fs.writeFile(
    path.join(claudeHome, "settings.json"),
    `${JSON.stringify({
      permissions: { allow: ["Bash(npm test)"] },
      hooks: { Stop: [{ hooks: [{ type: "command", command: "/usr/bin/env unrelated-stop" }] }] },
    }, null, 2)}\n`,
  );

  const result = run(["host", "install", "claude", "--json"], {
    env: { SLA_HOME: slaHome, CLAUDE_CONFIG_DIR: claudeHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.host, "claude");
  assert.equal(parsed.data.installPath, path.join(claudeHome, "skills"));
  assert.equal(parsed.data.hooksConfigPath, path.join(claudeHome, "settings.json"));
  assert.equal(parsed.data.stopHookPath, path.join(claudeHome, "hooks", "sla-stop-hook.js"));
  assert.equal(parsed.data.sessionStartHookPath, path.join(claudeHome, "hooks", "sla-session-start-hook.js"));
  assert.equal(
    parsed.data.persistenceReviewStartHookPath,
    path.join(claudeHome, "hooks", "sla-persistence-review-start-hook.js"),
  );
  assert.equal(parsed.data.persistenceReviewAgentPath, path.join(claudeHome, "agents", "sla-persistence-review.md"));
  assert.equal(parsed.data.persistenceActivityPath, path.join(slaHome, "activity", "persistence.jsonl"));
  await assertPathExists(path.join(claudeHome, "skills", "sla-use-profile", "SKILL.md"));
  await assertPathExists(path.join(claudeHome, "hooks", "sla-session-start-hook.js"));
  await assertPathExists(path.join(claudeHome, "hooks", "sla-persistence-review-start-hook.js"));

  const settings = JSON.parse(await fs.readFile(path.join(claudeHome, "settings.json"), "utf8"));
  assert.deepEqual(settings.permissions.allow, ["Bash(npm test)"]);
  assert.equal(settings.hooks.Stop[0].hooks[0].command, "/usr/bin/env unrelated-stop");
  assert.equal(
    settings.hooks.Stop[1].hooks[0].command,
    `node ${JSON.stringify(path.join(claudeHome, "hooks", "sla-stop-hook.js"))}`,
  );
  assert.equal(
    settings.hooks.SessionStart[0].hooks[0].command,
    `node ${JSON.stringify(path.join(claudeHome, "hooks", "sla-session-start-hook.js"))}`,
  );
  assert.equal(settings.hooks.SubagentStart[0].matcher, "^sla-persistence-review$");
  assert.equal(
    settings.hooks.SubagentStart[0].hooks[0].command,
    `node ${JSON.stringify(path.join(claudeHome, "hooks", "sla-persistence-review-start-hook.js"))}`,
  );

  const stopHookPath = path.join(claudeHome, "hooks", "sla-stop-hook.js");
  const dispatched = runCommand(process.execPath, [stopHookPath], {
    env: { SLA_HOME: slaHome, CLAUDE_CONFIG_DIR: claudeHome },
    input: JSON.stringify({ stop_hook_active: false }),
  });
  assert.equal(dispatched.status, 0, dispatched.stderr);
  const stopPayload = JSON.parse(dispatched.stdout);
  assert.equal(stopPayload.decision, "block");
  assert.match(stopPayload.reason, /use the Agent tool to dispatch exactly one `sla-persistence-review` custom subagent now/);
  assert.equal(
    runCommand(process.execPath, [stopHookPath], {
      input: JSON.stringify({ stop_hook_active: true }),
    }).stdout,
    "",
  );

  const agentDefinition = await fs.readFile(path.join(claudeHome, "agents", "sla-persistence-review.md"), "utf8");
  assert.match(agentDefinition, /^---\nname: sla-persistence-review\n/m);
  assert.match(agentDefinition, /^tools: Bash, Read$/m);
  assert.match(agentDefinition, /parent-session transcript snapshot supplied by the matching SubagentStart hook/);
  assert.match(agentDefinition, /sla active-context list <profile> --json/);

  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "claude-repo-"));
  assert.equal(run(["session", "install", "--profile", "default"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome },
  }).status, 0);
  const sessionStart = runCommand(process.execPath, [path.join(claudeHome, "hooks", "sla-session-start-hook.js")], {
    env: { SLA_HOME: slaHome, CLAUDE_CONFIG_DIR: claudeHome },
    input: JSON.stringify({ cwd: repositoryPath }),
  });
  assert.equal(sessionStart.status, 0, sessionStart.stderr);
  assert.equal(JSON.parse(sessionStart.stdout).hookSpecificOutput.hookEventName, "SessionStart");
  const childStart = runCommand(process.execPath, [path.join(claudeHome, "hooks", "sla-persistence-review-start-hook.js")], {
    env: { SLA_HOME: slaHome, CLAUDE_CONFIG_DIR: claudeHome },
    input: JSON.stringify({ cwd: repositoryPath, transcript_path: "/tmp/parent-session.jsonl" }),
  });
  assert.equal(childStart.status, 0, childStart.stderr);
  const childPayload = JSON.parse(childStart.stdout);
  assert.equal(childPayload.hookSpecificOutput.hookEventName, "SubagentStart");
  assert.match(childPayload.hookSpecificOutput.additionalContext, /SLA Repository Profiles: default/);
  assert.match(childPayload.hookSpecificOutput.additionalContext, /parent-session transcript snapshot at \/tmp\/parent-session\.jsonl/);

  const localResult = run(["host", "install", "claude", "--repository", repositoryPath, "--yes", "--json"], {
    env: { SLA_HOME: slaHome, CLAUDE_CONFIG_DIR: claudeHome },
  });
  assert.equal(localResult.status, 0);
  const localSettings = JSON.parse(await fs.readFile(path.join(repositoryPath, ".claude", "settings.json"), "utf8"));
  assert.equal(localSettings.hooks.Stop[0].hooks[0].command, "node .claude/hooks/sla-stop-hook.js");
});

test("Claude hook uninstall removes only SLA lifecycle assets", async () => {
  const slaHome = await createInstalledSlaHome();
  const claudeHome = await fs.mkdtemp(path.join(os.tmpdir(), "claude-test-"));
  const env = { SLA_HOME: slaHome, CLAUDE_CONFIG_DIR: claudeHome };
  await fs.writeFile(path.join(claudeHome, "settings.json"), JSON.stringify({
    hooks: {
      Stop: [{ hooks: [{ type: "command", command: "/usr/bin/env unrelated-stop" }] }],
      SessionStart: [{ hooks: [{ type: "command", command: "/usr/bin/env unrelated-start" }] }],
      SubagentStart: [{ matcher: "other-agent", hooks: [{ type: "command", command: "/usr/bin/env unrelated-child" }] }],
    },
  }, null, 2));

  assert.equal(run(["host", "install", "claude", "--json"], { env }).status, 0);
  const result = run(["host", "uninstall-hooks", "claude", "--json"], { env });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.removedFiles.includes(path.join(claudeHome, "hooks", "sla-stop-hook.js")), true);
  assert.equal(parsed.data.removedFiles.includes(path.join(claudeHome, "hooks", "sla-session-start-hook.js")), true);
  assert.equal(parsed.data.removedFiles.includes(path.join(claudeHome, "hooks", "sla-persistence-review-start-hook.js")), true);
  assert.equal(parsed.data.removedFiles.includes(path.join(claudeHome, "agents", "sla-persistence-review.md")), true);

  const settings = JSON.parse(await fs.readFile(path.join(claudeHome, "settings.json"), "utf8"));
  assert.equal(settings.hooks.Stop[0].hooks[0].command, "/usr/bin/env unrelated-stop");
  assert.equal(settings.hooks.SessionStart[0].hooks[0].command, "/usr/bin/env unrelated-start");
  assert.equal(settings.hooks.SubagentStart[0].hooks[0].command, "/usr/bin/env unrelated-child");
});

test("installs Cursor host wrappers into the configured Cursor home and records metadata", async () => {
  const slaHome = await createInstalledSlaHome();
  const cursorHome = await fs.mkdtemp(path.join(os.tmpdir(), "cursor-test-"));

  const result = run(["host", "install", "cursor", "--json"], {
    env: { SLA_HOME: slaHome, CURSOR_HOME: cursorHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.host, "cursor");
  assert.equal(parsed.data.installPath, path.join(cursorHome, "skills"));
  assert.equal(parsed.data.hookScope, "global");
  assert.equal(parsed.data.repositoryPath, null);
  assert.equal(parsed.data.hooksConfigPath, path.join(cursorHome, "hooks.json"));
  assert.equal(parsed.data.stopHookPath, path.join(cursorHome, "hooks", "sla-stop-hook.js"));
  assert.deepEqual(parsed.data.installedSkills, ["/use-profile", "/create-profile", "/update-profile"]);
  assert.equal(parsed.data.createdFiles.length, 5);
  assert.deepEqual(parsed.data.updatedFiles, []);
  assert.deepEqual(parsed.data.unchangedFiles, []);
  assert.ok(parsed.data.installedAt);

  const useProfileSkill = await fs.readFile(
    path.join(cursorHome, "skills", "sla-use-profile", "SKILL.md"),
    "utf8",
  );
  assert.match(useProfileSkill, /sla profile dir <name>/);
  assert.match(useProfileSkill, /sla profile context <name> --json/);
  assert.match(useProfileSkill, /Do not guess profile names/);

  const stopHookScript = await fs.readFile(path.join(cursorHome, "hooks", "sla-stop-hook.js"), "utf8");
  assert.match(stopHookScript, /followup_message/);
  assert.match(stopHookScript, /payload\.status !== "completed"/);
  assert.match(stopHookScript, /sla profile classify <name> --stdin/);

  const hooksConfig = JSON.parse(await fs.readFile(path.join(cursorHome, "hooks.json"), "utf8"));
  assert.equal(hooksConfig.version, 1);
  assert.equal(Array.isArray(hooksConfig.hooks.stop), true);
  assert.equal(hooksConfig.hooks.stop.length, 1);
  assert.equal(
    hooksConfig.hooks.stop[0].command,
    `node ${JSON.stringify(path.join(cursorHome, "hooks", "sla-stop-hook.js"))}`,
  );

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.hosts.cursor.installed, true);
  assert.equal(config.hosts.cursor.installPath, path.join(cursorHome, "skills"));
  assert.equal(config.hosts.cursor.hooksConfigPath, path.join(cursorHome, "hooks.json"));
  assert.equal(config.hosts.cursor.stopHookPath, path.join(cursorHome, "hooks", "sla-stop-hook.js"));
  assert.equal(config.hosts.cursor.hookScope, "global");
  assert.equal(config.hosts.cursor.repositoryPath, null);
  assert.deepEqual(config.hosts.cursor.installedSkills, [
    "/use-profile",
    "/create-profile",
    "/update-profile",
  ]);
  assert.ok(config.hosts.cursor.installedAt);
});

test("Cursor host install can target a repository-local hook config", async () => {
  const slaHome = await createInstalledSlaHome();
  const cursorHome = await fs.mkdtemp(path.join(os.tmpdir(), "cursor-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "cursor-repo-"));
  const resolvedRepositoryPath = await fs.realpath(repositoryPath);

  const result = run(["host", "install", "cursor", "--repository", repositoryPath, "--json"], {
    env: { SLA_HOME: slaHome, CURSOR_HOME: cursorHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.hookScope, "repository");
  assert.equal(parsed.data.repositoryPath, resolvedRepositoryPath);
  assert.equal(parsed.data.hooksConfigPath, path.join(resolvedRepositoryPath, ".cursor", "hooks.json"));
  assert.equal(
    parsed.data.stopHookPath,
    path.join(resolvedRepositoryPath, ".cursor", "hooks", "sla-stop-hook.js"),
  );

  await assertPathMissing(path.join(cursorHome, "hooks.json"));
  await assertPathMissing(path.join(cursorHome, "hooks", "sla-stop-hook.js"));
  await assertPathExists(path.join(resolvedRepositoryPath, ".cursor", "hooks.json"));
  await assertPathExists(path.join(resolvedRepositoryPath, ".cursor", "hooks", "sla-stop-hook.js"));

  const hooksConfig = JSON.parse(await fs.readFile(path.join(resolvedRepositoryPath, ".cursor", "hooks.json"), "utf8"));
  assert.equal(hooksConfig.hooks.stop[0].command, "node .cursor/hooks/sla-stop-hook.js");

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.hosts.cursor.hookScope, "repository");
  assert.equal(config.hosts.cursor.repositoryPath, resolvedRepositoryPath);
});

test("rerunning Cursor host install is idempotent", async () => {
  const slaHome = await createInstalledSlaHome();
  const cursorHome = await fs.mkdtemp(path.join(os.tmpdir(), "cursor-test-"));

  const first = run(["host", "install", "cursor", "--json"], {
    env: { SLA_HOME: slaHome, CURSOR_HOME: cursorHome },
  });
  assert.equal(first.status, 0);

  const blocked = run(["host", "install", "cursor", "--json"], {
    env: { SLA_HOME: slaHome, CURSOR_HOME: cursorHome },
  });
  assert.equal(blocked.status, 1);
  const blockedParsed = JSON.parse(blocked.stdout);
  assert.equal(blockedParsed.ok, false);
  assert.equal(blockedParsed.error.code, "HOST_INSTALL_OVERWRITE_REQUIRED");

  const second = run(["host", "install", "cursor", "--yes", "--json"], {
    env: { SLA_HOME: slaHome, CURSOR_HOME: cursorHome },
  });
  assert.equal(second.status, 0);

  const secondParsed = JSON.parse(second.stdout);
  assert.equal(secondParsed.ok, true);
  assert.deepEqual(secondParsed.data.createdFiles, []);
  assert.deepEqual(secondParsed.data.updatedFiles, []);
  assert.equal(secondParsed.data.unchangedFiles.length, 5);
});

test("Hermes host install requires the explicit Hermes runtime flag", async () => {
  const hermesHome = await createInstalledHermesHome();

  const result = run(["host", "install", "hermes", "--json"], {
    env: { SLA_HOME: hermesHome },
  });
  assert.equal(result.status, 2);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "HERMES_AGENT_FLAG_REQUIRED");
});

test("installs Hermes host wrappers into the selected Hermes profile and records metadata", async () => {
  const hermesHome = await createInstalledHermesHome();
  const env = { SLA_HOME: hermesHome };

  const result = runHermes(["host", "install", "hermes", "--json"], { env });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data.host, "hermes");
  assert.equal(parsed.data.profile, "default");
  assert.equal(parsed.data.installPath, path.join(hermesHome, "profiles", "default", "skills"));
  assert.equal(parsed.data.hooksConfigPath, null);
  assert.equal(parsed.data.stopHookPath, null);
  assert.equal(parsed.data.hookScope, null);
  assert.equal(parsed.data.repositoryPath, null);
  assert.deepEqual(parsed.data.installedSkills, ["/use-profile", "/create-profile", "/update-profile"]);
  assert.ok(parsed.data.installedAt);

  const useProfileSkill = await fs.readFile(
    path.join(
      hermesHome,
      "profiles",
      "default",
      "skills",
      "general",
      "sla-use-profile",
      "SKILL.md",
    ),
    "utf8",
  );
  assert.match(useProfileSkill, /~\/\.hermes\/profiles\/<profile>/);
  assert.match(useProfileSkill, /skills\/general\/deploy/);
  assert.match(useProfileSkill, /--category <category>/);
  assert.match(useProfileSkill, /Hermes does not provide hook-driven persistence/);

  const config = JSON.parse(await fs.readFile(path.join(hermesHome, "config.json"), "utf8"));
  assert.equal(config.hosts.hermes.installed, true);
  assert.equal(config.hosts.hermes.installPath, path.join(hermesHome, "profiles", "default", "skills"));
  assert.equal(config.hosts.hermes.profile, "default");
  assert.deepEqual(config.hosts.hermes.installedSkills, [
    "/use-profile",
    "/create-profile",
    "/update-profile",
  ]);
  assert.ok(config.hosts.hermes.installedAt);
});

test("Hermes host install uses the requested existing profile and rejects unknown profiles", async () => {
  const hermesHome = await createInstalledHermesHome();
  const env = { SLA_HOME: hermesHome };
  assert.equal(runHermes(["profile", "create", "ops"], { env }).status, 0);

  const installed = runHermes(["host", "install", "hermes", "--hermes-profile", "ops", "--json"], { env });
  assert.equal(installed.status, 0);
  await assertPathExists(
    path.join(hermesHome, "profiles", "ops", "skills", "general", "sla-update-profile", "SKILL.md"),
  );

  const missing = runHermes(
    ["host", "install", "hermes", "--hermes-profile", "missing", "--json"],
    { env },
  );
  assert.equal(missing.status, 1);
  const missingParsed = JSON.parse(missing.stdout);
  assert.equal(missingParsed.ok, false);
  assert.equal(missingParsed.error.code, "PROFILE_NOT_FOUND");
});

test("codex host install merges SessionStart and preserves unrelated hooks", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  await fs.mkdir(path.join(codexHome, "hooks"), { recursive: true });
  await fs.writeFile(
    path.join(codexHome, "hooks.json"),
    `${JSON.stringify(
      {
        hooks: {
          Stop: [
            {
              matcher: { cwd: "/tmp/project" },
              hooks: [
                {
                  type: "command",
                  command: "/usr/bin/env existing-stop",
                  timeout: 10,
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );

  const result = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const hooksConfig = JSON.parse(await fs.readFile(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(hooksConfig.hooks.Stop.length, 2);
  assert.equal(hooksConfig.hooks.Stop[0].matcher.cwd, "/tmp/project");
  assert.equal(hooksConfig.hooks.Stop[0].hooks[0].command, "/usr/bin/env existing-stop");
  assert.equal(
    hooksConfig.hooks.SessionStart[0].hooks[0].command,
    "node " + JSON.stringify(path.join(codexHome, "hooks", "sla-session-start-hook.js")),
  );
});

test("codex hook uninstall removes SLA Stop and SessionStart hooks without removing unrelated hooks", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const env = { SLA_HOME: slaHome, CODEX_HOME: codexHome };
  await fs.mkdir(path.join(codexHome, "hooks"), { recursive: true });
  await fs.writeFile(path.join(codexHome, "hooks.json"), JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: "command", command: "/usr/bin/env unrelated-stop" }] }] },
  }, null, 2));

  assert.equal(run(["host", "install", "codex", "--json"], { env }).status, 0);
  const result = run(["host", "uninstall-hooks", "codex", "--json"], { env });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.removedFiles.includes(path.join(codexHome, "hooks", "sla-stop-hook.js")), true);
  assert.equal(parsed.data.removedFiles.includes(path.join(codexHome, "hooks", "sla-session-start-hook.js")), true);
  assert.equal(parsed.data.removedFiles.includes(path.join(codexHome, "agents", "sla-persistence-review.toml")), true);
  await assertPathMissing(path.join(codexHome, "hooks", "sla-stop-hook.js"));
  await assertPathMissing(path.join(codexHome, "hooks", "sla-session-start-hook.js"));
  await assertPathMissing(path.join(codexHome, "agents", "sla-persistence-review.toml"));

  const hooksConfig = JSON.parse(await fs.readFile(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(hooksConfig.hooks.Stop.length, 1);
  assert.equal(hooksConfig.hooks.Stop[0].hooks[0].command, "/usr/bin/env unrelated-stop");
  assert.equal(hooksConfig.hooks.SessionStart, undefined);
});

test("codex host install can target a repository-local codex hook config", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const resolvedRepositoryPath = await fs.realpath(repositoryPath);

  const result = run(["host", "install", "codex", "--repository", repositoryPath, "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.hookScope, "repository");
  assert.equal(parsed.data.repositoryPath, resolvedRepositoryPath);
  assert.equal(parsed.data.hooksConfigPath, path.join(resolvedRepositoryPath, ".codex", "hooks.json"));
  assert.equal(parsed.data.stopHookPath, path.join(resolvedRepositoryPath, ".codex", "hooks", "sla-stop-hook.js"));
  assert.equal(parsed.data.sessionStartHookPath, path.join(resolvedRepositoryPath, ".codex", "hooks", "sla-session-start-hook.js"));
  assert.equal(parsed.data.persistenceReviewAgentPath, path.join(resolvedRepositoryPath, ".codex", "agents", "sla-persistence-review.toml"));

  await assertPathMissing(path.join(codexHome, "hooks.json"));
  await assertPathMissing(path.join(codexHome, "hooks", "sla-session-start-hook.js"));
  await assertPathExists(path.join(resolvedRepositoryPath, ".codex", "hooks.json"));
  await assertPathExists(path.join(resolvedRepositoryPath, ".codex", "hooks", "sla-session-start-hook.js"));
  await assertPathExists(path.join(resolvedRepositoryPath, ".codex", "agents", "sla-persistence-review.toml"));
  await assertPathMissing(path.join(resolvedRepositoryPath, ".gitignore"));

  const hooksConfig = JSON.parse(await fs.readFile(path.join(resolvedRepositoryPath, ".codex", "hooks.json"), "utf8"));
  assert.equal(hooksConfig.hooks.SessionStart[0].hooks[0].command, "node .codex/hooks/sla-session-start-hook.js");

  const config = JSON.parse(await fs.readFile(path.join(slaHome, "config.json"), "utf8"));
  assert.equal(config.hosts.codex.hookScope, "repository");
  assert.equal(config.hosts.codex.repositoryPath, resolvedRepositoryPath);
});

test("codex host install does not modify repository .gitignore by default", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const resolvedRepositoryPath = await fs.realpath(repositoryPath);

  await fs.writeFile(path.join(resolvedRepositoryPath, ".gitignore"), "node_modules/\ncoverage/\n", "utf8");

  const result = run(["host", "install", "codex", "--repository", repositoryPath, "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(
    await fs.readFile(path.join(resolvedRepositoryPath, ".gitignore"), "utf8"),
    "node_modules/\ncoverage/\n",
  );
  assert.equal(parsed.data.updatedFiles.includes(path.join(resolvedRepositoryPath, ".gitignore")), false);
  assert.equal(parsed.data.unchangedFiles.includes(path.join(resolvedRepositoryPath, ".gitignore")), false);
});

test("codex host install appends .codex/ to an existing repository .gitignore when --gitignore is given", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const resolvedRepositoryPath = await fs.realpath(repositoryPath);

  await fs.writeFile(path.join(resolvedRepositoryPath, ".gitignore"), "node_modules/\ncoverage/\n", "utf8");

  const result = run(["host", "install", "codex", "--repository", repositoryPath, "--gitignore", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.match(
    await fs.readFile(path.join(resolvedRepositoryPath, ".gitignore"), "utf8"),
    /node_modules\/\ncoverage\/\n\.codex\/\n$/,
  );
  assert.ok(parsed.data.updatedFiles.includes(path.join(resolvedRepositoryPath, ".gitignore")));
});

test("codex host install leaves repository .gitignore unchanged when --gitignore is given and .codex is already ignored", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const resolvedRepositoryPath = await fs.realpath(repositoryPath);

  await fs.writeFile(path.join(resolvedRepositoryPath, ".gitignore"), "node_modules/\n.codex/\n", "utf8");

  const result = run(["host", "install", "codex", "--repository", repositoryPath, "--gitignore", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(
    await fs.readFile(path.join(resolvedRepositoryPath, ".gitignore"), "utf8"),
    "node_modules/\n.codex/\n",
  );
  assert.ok(parsed.data.unchangedFiles.includes(path.join(resolvedRepositoryPath, ".gitignore")));
});

test("codex host install accepts a positional repository shorthand", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const resolvedRepositoryPath = await fs.realpath(repositoryPath);

  const result = run(["host", "install", "codex", ".", "--json"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.hookScope, "repository");
  assert.equal(parsed.data.repositoryPath, resolvedRepositoryPath);
  assert.equal(parsed.data.hooksConfigPath, path.join(resolvedRepositoryPath, ".codex", "hooks.json"));
  assert.equal(parsed.data.sessionStartHookPath, path.join(resolvedRepositoryPath, ".codex", "hooks", "sla-session-start-hook.js"));
});

test("codex host install updates an existing .codex directory when shorthand resolves inside it", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const codexDirPath = path.join(repositoryPath, ".codex");
  await fs.mkdir(codexDirPath, { recursive: true });
  const resolvedCodexDirPath = await fs.realpath(codexDirPath);

  const result = run(["host", "install", "codex", ".", "--json"], {
    cwd: codexDirPath,
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(result.status, 0);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.hookScope, "repository");
  assert.equal(parsed.data.repositoryPath, resolvedCodexDirPath);
  assert.equal(parsed.data.hooksConfigPath, path.join(resolvedCodexDirPath, "hooks.json"));
  assert.equal(parsed.data.sessionStartHookPath, path.join(resolvedCodexDirPath, "hooks", "sla-session-start-hook.js"));

  await assertPathExists(path.join(resolvedCodexDirPath, "hooks.json"));
  await assertPathExists(path.join(resolvedCodexDirPath, "hooks", "sla-session-start-hook.js"));
  await assertPathMissing(path.join(resolvedCodexDirPath, ".codex", "hooks.json"));
  await assertPathMissing(path.join(resolvedCodexDirPath, ".codex", "hooks", "sla-session-start-hook.js"));

  const hooksConfig = JSON.parse(await fs.readFile(path.join(resolvedCodexDirPath, "hooks.json"), "utf8"));
  assert.equal(hooksConfig.hooks.SessionStart[0].hooks[0].command, "node .codex/hooks/sla-session-start-hook.js");
});

test("codex host install rejects conflicting repository shorthand and option values", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));
  const otherRepositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-repo-"));

  const result = run(
    ["host", "install", "codex", repositoryPath, "--repository", otherRepositoryPath, "--json"],
    {
      env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
    },
  );
  assert.equal(result.status, 2);

  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, "HOST_INSTALL_REPOSITORY_CONFLICT");
});

test.skip("obsolete: installed codex stop hook includes profiles extracted from the session transcript", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  const installed = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(installed.status, 0);

  const transcriptPath = path.join(codexHome, "session.jsonl");
  await fs.writeFile(
    transcriptPath,
    [
      JSON.stringify({
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "/use-profile research - investigate the failing API",
            },
          ],
        },
      }),
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "/use-profile ops and then review deployment state",
        },
      }),
      JSON.stringify({
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "/use-profile research for one more follow-up",
        },
      }),
      "",
    ].join("\n"),
    "utf8",
  );

  const hookResult = runCommand(
    process.execPath,
    [path.join(codexHome, "hooks", "sla-stop-hook.js")],
    {
      input: JSON.stringify({
        transcript_path: transcriptPath,
        stop_hook_active: false,
      }),
    },
  );
  assert.equal(hookResult.status, 0, hookResult.stderr);

  const payload = JSON.parse(hookResult.stdout);
  assert.equal(payload.decision, "block");
  assert.match(payload.reason, /^SLA -> Before stopping, review this session for durable SLA profile updates\./);
  assert.match(payload.reason, /Use the SLA profiles established in this session: research, ops\./);
  assert.match(
    payload.reason,
    /Persist durable memories and skills against the correct listed profile\./,
  );
  assert.match(payload.reason, /Create or update reference docs/);
  assert.doesNotMatch(payload.reason, /If no explicit profile was established/);
});

test.skip("obsolete: installed codex stop hook ignores prose mentions of /use-profile", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  const installed = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(installed.status, 0);

  const transcriptPath = path.join(codexHome, "session.jsonl");
  await fs.writeFile(
    transcriptPath,
    `${JSON.stringify({
      type: "event_msg",
      payload: {
        type: "user_message",
        message:
          "The user can use as many /use-profile as he needs, but that sentence is explanatory prose, not a command.",
      },
    })}\n`,
    "utf8",
  );

  const hookResult = runCommand(
    process.execPath,
    [path.join(codexHome, "hooks", "sla-stop-hook.js")],
    {
      input: JSON.stringify({
        transcript_path: transcriptPath,
        stop_hook_active: false,
      }),
    },
  );
  assert.equal(hookResult.status, 0, hookResult.stderr);

  const payload = JSON.parse(hookResult.stdout);
  assert.match(payload.reason, /^SLA -> Before stopping, review this session for durable SLA profile updates\./);
  assert.doesNotMatch(payload.reason, /Use the SLA profiles established in this session:/);
  assert.match(payload.reason, /If no explicit profile was established, use `sla profile get-default`/);
  assert.match(payload.reason, /Persist reusable repo\/domain\/task capabilities by creating or updating a skill/);
  assert.match(payload.reason, /Keep `SKILL.md` action-oriented/);
});

test.skip("obsolete: installed codex stop hook falls back when no explicit profile was established", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));

  const installed = run(["host", "install", "codex", "--json"], {
    env: { SLA_HOME: slaHome, CODEX_HOME: codexHome },
  });
  assert.equal(installed.status, 0);

  const transcriptPath = path.join(codexHome, "session.jsonl");
  await fs.writeFile(
    transcriptPath,
    `${JSON.stringify({
      type: "event_msg",
      payload: {
        type: "user_message",
        message: "Please debug this repo",
      },
    })}\n`,
    "utf8",
  );

  const hookResult = runCommand(
    process.execPath,
    [path.join(codexHome, "hooks", "sla-stop-hook.js")],
    {
      input: JSON.stringify({
        transcript_path: transcriptPath,
        stop_hook_active: false,
      }),
    },
  );
  assert.equal(hookResult.status, 0, hookResult.stderr);

  const payload = JSON.parse(hookResult.stdout);
  assert.equal(payload.decision, "block");
  assert.match(payload.reason, /^SLA -> Before stopping, review this session for durable SLA profile updates\./);
  assert.match(payload.reason, /If no explicit profile was established, use `sla profile get-default`/);
  assert.match(payload.reason, /Create or update reference docs/);
});

test("codex Stop hook dispatches one concise persistence-review continuation", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const env = { SLA_HOME: slaHome, CODEX_HOME: codexHome };

  assert.equal(run(["host", "install", "codex", "--json"], { env }).status, 0);
  const hookPath = path.join(codexHome, "hooks", "sla-stop-hook.js");

  const dispatched = runCommand(process.execPath, [hookPath], {
    env,
    input: JSON.stringify({ stop_hook_active: false }),
  });
  assert.equal(dispatched.status, 0, dispatched.stderr);
  const payload = JSON.parse(dispatched.stdout);
  assert.equal(payload.decision, "block");
  assert.match(payload.reason, /spawn exactly one `sla-persistence-review` subagent now/);
  assert.match(payload.reason, /Do not perform the review yourself/);
  assert.match(payload.reason, /Do not announce the dispatch, narrate progress, or send a separate handoff message/);
  assert.match(payload.reason, /respond with exactly its one-line result and nothing else/);
  assert.match(payload.reason, /profiles=none; failed: dispatch-unavailable/);
  assert.doesNotMatch(payload.reason, /mandatory persistence review|sla memory add|references\/\*\.md/);

  const hooksConfig = JSON.parse(await fs.readFile(path.join(codexHome, "hooks.json"), "utf8"));
  assert.equal(hooksConfig.hooks.Stop[0].hooks[0].statusMessage, undefined);

  const guarded = runCommand(process.execPath, [hookPath], {
    env,
    input: JSON.stringify({ stop_hook_active: true }),
  });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.equal(guarded.stdout, "");

  const malformed = runCommand(process.execPath, [hookPath], { env, input: "not-json" });
  assert.equal(malformed.status, 0, malformed.stderr);
  assert.equal(malformed.stdout, "");
});

test("documents and exposes persistence activity in a disposable Codex installation", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const env = { SLA_HOME: slaHome, CODEX_HOME: codexHome };

  const install = run(["host", "install", "codex", "--json"], { env });
  assert.equal(install.status, 0, install.stderr);
  assert.equal(JSON.parse(install.stdout).data.persistenceActivityPath, path.join(slaHome, "activity", "persistence.jsonl"));

  const help = run(["help", "persistence", "activity"], { env });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Show concise, redacted persistence-review outcomes/);

  const readme = await fs.readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.match(readme, /sla persistence activity/);
  assert.match(readme, /does not announce that dispatch or emit a progress update/);
  assert.match(readme, /unrelated hooks and skills are preserved/);
});

test("codex SessionStart hook injects configured profiles and silently no-ops otherwise", async () => {
  const slaHome = await createInstalledSlaHome();
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), "codex-test-"));
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-repo-"));
  const env = { SLA_HOME: slaHome, CODEX_HOME: codexHome };
  assert.equal(run(["profile", "create", "research"], { env }).status, 0);
  assert.equal(run(["soul", "edit", "research", "--stdin"], {
    env,
    input: "# SOUL\\n\\nResearch bootstrap context.\\n",
  }).status, 0);
  assert.equal(run(["active-context", "add", "research", "--entry", "Research incident bridge", "--expires-at", "2099-01-01T00:00:00Z"], { env }).status, 0);
  assert.equal(run(["active-context", "add", "default", "--entry", "Default-only incident bridge", "--expires-at", "2099-01-01T00:00:00Z"], { env }).status, 0);
  assert.equal(run(["session", "install", "--profile", "research", "--profile", "default"], {
    cwd: repositoryPath,
    env,
  }).status, 0);
  assert.equal(run(["host", "install", "codex", "--json"], { env }).status, 0);

  const hookPath = path.join(codexHome, "hooks", "sla-session-start-hook.js");
  for (const source of ["startup", "resume", "clear", "compact"]) {
    const hookResult = runCommand(process.execPath, [hookPath], {
      env,
      input: JSON.stringify({ cwd: repositoryPath, source }),
    });
    assert.equal(hookResult.status, 0, hookResult.stderr);
    const payload = JSON.parse(hookResult.stdout);
    assert.equal(payload.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(payload.hookSpecificOutput.additionalContext, /SLA Repository Profiles: research, default/);
    assert.match(payload.hookSpecificOutput.additionalContext, /Research bootstrap context/);
    assert.match(payload.hookSpecificOutput.additionalContext, /Research incident bridge/);
    assert.match(payload.hookSpecificOutput.additionalContext, /Default-only incident bridge/);
    assert.match(payload.hookSpecificOutput.additionalContext, /temporary, advisory operational context/);
    assert.match(payload.hookSpecificOutput.additionalContext, /skill index is not the full skill body/);
    assert.match(payload.hookSpecificOutput.additionalContext, /direct edits under ~\/\.sla/);
  }

  const unconfiguredPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-unconfigured-"));
  const noMarker = runCommand(process.execPath, [hookPath], {
    env,
    input: JSON.stringify({ cwd: unconfiguredPath }),
  });
  assert.equal(noMarker.status, 0, noMarker.stderr);
  assert.equal(noMarker.stdout, "");

  await fs.writeFile(path.join(unconfiguredPath, ".sla"), "{ bad json", "utf8");
  const malformed = runCommand(process.execPath, [hookPath], {
    env,
    input: JSON.stringify({ cwd: unconfiguredPath }),
  });
  assert.equal(malformed.status, 0, malformed.stderr);
  assert.equal(malformed.stdout, "");

  await fs.writeFile(path.join(unconfiguredPath, ".sla"), '{"schemaVersion":1,"profiles":["missing"]}\\n', "utf8");
  const missing = runCommand(process.execPath, [hookPath], {
    env,
    input: JSON.stringify({ cwd: unconfiguredPath }),
  });
  assert.equal(missing.status, 0, missing.stderr);
  assert.equal(missing.stdout, "");
});

test("session install writes an ordered manifest and updates an existing gitignore once", async () => {
  const slaHome = await createInstalledSlaHome();
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-repo-"));
  await fs.writeFile(path.join(repositoryPath, ".gitignore"), "node_modules/\r\n", "utf8");
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });

  const installed = run(
    ["session", "install", "--profile", "research", "--profile", "default", "--json"],
    { cwd: repositoryPath, env: { SLA_HOME: slaHome } },
  );
  assert.equal(installed.status, 0, installed.stderr);
  const parsed = JSON.parse(installed.stdout);
  assert.deepEqual(parsed.data.profiles, ["research", "default"]);
  assert.equal(parsed.data.manifestPath, path.join(await fs.realpath(repositoryPath), ".sla"));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(repositoryPath, ".sla"), "utf8")), {
    schemaVersion: 1,
    profiles: ["research", "default"],
  });
  assert.equal(await fs.readFile(path.join(repositoryPath, ".gitignore"), "utf8"), "node_modules/\r\n.sla\r\n");

  const overwritten = run(["session", "install", "--profile", "research", "--yes"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome },
  });
  assert.equal(overwritten.status, 0, overwritten.stderr);
  assert.equal((await fs.readFile(path.join(repositoryPath, ".gitignore"), "utf8")).match(/\.sla/g).length, 1);
});

test("session install requires existing profiles, explicit overwrite, and does not create gitignore", async () => {
  const slaHome = await createInstalledSlaHome();
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-repo-"));

  const missing = run(["session", "install", "--profile", "missing", "--json"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome },
  });
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).error.code, "PROFILE_NOT_FOUND");

  const installed = run(["session", "install", "--profile", "default"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome },
  });
  assert.equal(installed.status, 0, installed.stderr);
  await assertPathMissing(path.join(repositoryPath, ".gitignore"));

  const overwrite = run(["session", "install", "--profile", "default", "--json"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome },
  });
  assert.equal(overwrite.status, 1);
  assert.equal(JSON.parse(overwrite.stdout).error.code, "SESSION_MANIFEST_OVERWRITE_REQUIRED");

  const duplicate = run(["session", "install", "--profile", "default", "--profile", "default", "--yes", "--json"], {
    cwd: repositoryPath,
    env: { SLA_HOME: slaHome },
  });
  assert.equal(duplicate.status, 2);
  assert.equal(JSON.parse(duplicate.stdout).error.code, "SESSION_PROFILE_DUPLICATE");
});

test("session bootstrap resolves the nearest manifest without using the global default", async () => {
  const slaHome = await createInstalledSlaHome();
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-repo-"));
  const nestedPath = path.join(repositoryPath, "packages", "api");
  await fs.mkdir(nestedPath, { recursive: true });
  run(["profile", "create", "research"], { env: { SLA_HOME: slaHome } });
  run(["soul", "edit", "research", "--stdin"], {
    env: { SLA_HOME: slaHome },
    input: "# SOUL\n\nRepository research context.\n",
  });
  assert.equal(run(["active-context", "add", "research", "--entry", "Research-only active context", "--expires-at", "2099-01-01T00:00:00Z"], { env: { SLA_HOME: slaHome } }).status, 0);
  assert.equal(run(["active-context", "add", "research", "--entry", "Expired research context", "--expires-at", "2000-01-01T00:00:00Z"], { env: { SLA_HOME: slaHome } }).status, 0);
  assert.equal(run(["active-context", "add", "default", "--entry", "Default-only active context", "--expires-at", "2099-01-01T00:00:00Z"], { env: { SLA_HOME: slaHome } }).status, 0);
  await fs.writeFile(path.join(repositoryPath, ".sla"), '{"schemaVersion":1,"profiles":["default"]}\n');
  await fs.writeFile(path.join(repositoryPath, "packages", ".sla"), '{"schemaVersion":1,"profiles":["research","default"]}\n');

  const result = run(["session", "bootstrap", nestedPath, "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.data.manifestPath, path.join(await fs.realpath(path.join(repositoryPath, "packages")), ".sla"));
  assert.equal(parsed.data.repositoryPath, await fs.realpath(path.join(repositoryPath, "packages")));
  assert.deepEqual(parsed.data.profiles.map((entry) => entry.profile), ["research", "default"]);
  assert.match(parsed.data.profiles[0].renderedContext, /Repository research context/);
  assert.deepEqual(parsed.data.profiles[0].operationalContext.entries.map((entry) => entry.content), ["Research-only active context"]);
  assert.deepEqual(parsed.data.profiles[1].operationalContext.entries.map((entry) => entry.content), ["Default-only active context"]);
  assert.doesNotMatch(parsed.data.profiles[0].renderedContext, /Expired research context|Default-only active context/);
  assert.doesNotMatch(parsed.data.profiles[1].renderedContext, /Research-only active context/);

  const unconfiguredPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-unconfigured-"));
  const unconfigured = run(["session", "bootstrap", unconfiguredPath, "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(unconfigured.status, 0);
  assert.deepEqual(JSON.parse(unconfigured.stdout).data, {
    found: false,
    manifestPath: null,
    repositoryPath: null,
    profiles: [],
  });

  const unconfiguredHuman = run(["session", "bootstrap", unconfiguredPath], { env: { SLA_HOME: slaHome } });
  assert.equal(unconfiguredHuman.status, 0);
  assert.equal(unconfiguredHuman.stdout.trim(), "No repository .sla manifest found.");
});

test("session bootstrap reports malformed manifests and missing configured profiles", async () => {
  const slaHome = await createInstalledSlaHome();
  const repositoryPath = await fs.mkdtemp(path.join(os.tmpdir(), "sla-session-repo-"));
  await fs.writeFile(path.join(repositoryPath, ".sla"), '{"schemaVersion":1,"profiles":["default","default"]}\n');

  const malformed = run(["session", "bootstrap", repositoryPath, "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(malformed.status, 1);
  assert.equal(JSON.parse(malformed.stdout).error.code, "INVALID_SESSION_MANIFEST");

  await fs.writeFile(path.join(repositoryPath, ".sla"), '{"schemaVersion":1,"profiles":["missing"]}\n');
  const missing = run(["session", "bootstrap", repositoryPath, "--json"], { env: { SLA_HOME: slaHome } });
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).error.code, "PROFILE_NOT_FOUND");
});

test("npm pack dry run includes only publish-safe runtime files", () => {
  const result = runExternal("npm", ["pack", "--json", "--dry-run"]);

  assert.equal(result.status, 0, result.stderr);
  const [packResult] = JSON.parse(result.stdout);
  const packedFiles = packResult.files.map((entry) => entry.path).sort();

  assert.deepEqual(packedFiles, [
    "LICENSE",
    "README.md",
    "bin/sla.js",
    "package.json",
    "src/cli.js",
    "src/commands/active-context.js",
    "src/commands/help.js",
    "src/commands/host.js",
    "src/commands/install.js",
    "src/commands/memory.js",
    "src/commands/persistence.js",
    "src/commands/profile.js",
    "src/commands/root.js",
    "src/commands/session.js",
    "src/commands/skill.js",
    "src/commands/soul.js",
    "src/commands/stats.js",
    "src/lib/bootstrap.js",
    "src/lib/config.js",
    "src/lib/constants.js",
    "src/lib/errors.js",
    "src/lib/examples.js",
    "src/lib/filesystem.js",
    "src/lib/hosts.js",
    "src/lib/memory.js",
    "src/lib/not-implemented.js",
    "src/lib/operational-context.js",
    "src/lib/output.js",
    "src/lib/paths.js",
    "src/lib/persistence.js",
    "src/lib/profile-context.js",
    "src/lib/profiles.js",
    "src/lib/repository-manifest.js",
    "src/lib/skills.js",
    "src/lib/soul.js",
    "src/lib/stats.js",
    "src/lib/usage.js",
    "src/lib/validation.js",
  ]);
});

test("packed tarball installs cleanly and exposes the sla binary", async () => {
  const packDestination = await fs.mkdtemp(path.join(os.tmpdir(), "sla-pack-"));
  const installDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "sla-install-"));

  const packed = runExternal("npm", ["pack", "--json", "--pack-destination", packDestination]);
  assert.equal(packed.status, 0, packed.stderr);

  const [packResult] = JSON.parse(packed.stdout);
  const tarballPath = path.join(packDestination, packResult.filename);

  const initialized = runExternal("npm", ["init", "-y"], { cwd: installDirectory });
  assert.equal(initialized.status, 0, initialized.stderr);

  const installed = runExternal("npm", ["install", tarballPath], { cwd: installDirectory });
  assert.equal(installed.status, 0, installed.stderr);

  const slaBinary = path.join(
    installDirectory,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "sla.cmd" : "sla",
  );
  const help = runCommand(slaBinary, ["help"], { cwd: installDirectory });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Profile-scoped memory and skills CLI for agents\./);
});

async function createTempSlaHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), "sla-test-"));
}

async function createInstalledSlaHome() {
  const slaHome = await createTempSlaHome();
  const result = run(["install"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);
  return slaHome;
}

async function createInstalledHermesHome() {
  const slaHome = await createTempSlaHome();
  const result = runHermes(["install"], { env: { SLA_HOME: slaHome } });
  assert.equal(result.status, 0);
  return slaHome;
}

async function assertPathExists(targetPath) {
  await fs.access(targetPath);
}

async function assertPathMissing(targetPath) {
  await assert.rejects(() => fs.access(targetPath));
}
