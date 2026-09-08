const fs = require("node:fs/promises");
const path = require("node:path");
const { saveConfig } = require("./config");
const { SLAError } = require("./errors");
const { ensureDirectory, pathExists, writeFileAtomic } = require("./filesystem");
const { getProfilePath, requireConfig, assertProfileExists } = require("./profiles");
const {
  getCodexAgentPath,
  getCodexCustomAgentPath,
  getCodexHookScriptPath,
  getCodexHooksConfigPath,
  getCodexHooksPath,
  getCodexSkillPath,
  getCodexSkillsPath,
  getPersistenceActivityPath,
  getClaudeHookScriptPath,
  getClaudeHooksPath,
  getClaudeSettingsPath,
  getClaudeSkillPath,
  getClaudeSkillsPath,
  getCursorHookScriptPath,
  getCursorHooksConfigPath,
  getCursorHooksPath,
  getCursorSkillPath,
  getCursorSkillsPath,
  getSkillsPath,
  getSkillPath,
  getAgentFlavor,
  isHermesAgentRequested,
} = require("./paths");

const HOST_SKILL_KEYS = ["sla-use-profile", "sla-create-profile", "sla-update-profile"];
const HOST_SKILL_COMMANDS = ["/use-profile", "/create-profile", "/update-profile"];
const OPENAI_STYLE_STOP_HOOK_FILE = "sla-stop-hook.js";
const CODEX_SESSION_START_HOOK_FILE = "sla-session-start-hook.js";
const CODEX_PERSISTENCE_REVIEW_AGENT = "sla-persistence-review";
const CODEX_SESSION_START_MATCHER = "startup|resume|clear|compact";
const CURSOR_STOP_HOOK_EVENT = "stop";

function getSupportedHosts() {
  return [createCodexAdapter(), createClaudeAdapter(), createCursorAdapter(), createHermesAdapter()];
}

function getHostAdapter(hostName) {
  const adapter = getSupportedHosts().find((entry) => entry.name === hostName);
  if (adapter) {
    return adapter;
  }

  throw new SLAError(`Host '${hostName}' is not supported.`, {
    code: "HOST_NOT_SUPPORTED",
    exitCode: 2,
    details: {
      host: hostName,
      supportedHosts: getSupportedHosts().map((entry) => entry.name),
    },
  });
}

async function installHost(hostName, options = {}) {
  const adapter = getHostAdapter(hostName);
  const config = await requireConfig();
  const installation = await adapter.install(options, config);
  const existing = config.hosts?.[hostName] || {};
  const installedAt = existing.installedAt || installation.configEntry.installedAt;

  const nextConfig = await saveConfig({
    ...config,
    hosts: {
      ...config.hosts,
      [hostName]: {
        ...existing,
        ...installation.configEntry,
        installedAt,
      },
    },
  });

  return {
    host: hostName,
    installPath: installation.installPath,
    hooksConfigPath: installation.hooksConfigPath ?? null,
    stopHookPath: installation.stopHookPath ?? null,
    sessionStartHookPath: installation.sessionStartHookPath ?? null,
    persistenceReviewAgentPath: installation.persistenceReviewAgentPath ?? null,
    persistenceActivityPath: getPersistenceActivityPath(),
    hookScope: installation.hookScope ?? null,
    repositoryPath: installation.repositoryPath ?? null,
    profile: installation.profile ?? null,
    installedSkills: installation.installedSkills,
    createdFiles: installation.createdFiles,
    updatedFiles: installation.updatedFiles,
    unchangedFiles: installation.unchangedFiles,
    removedFiles: installation.removedFiles || [],
    installedAt: nextConfig.hosts[hostName].installedAt,
  };
}

async function hostInstallRequiresOverwrite(hostName, options = {}) {
  const adapter = getHostAdapter(hostName);
  if (typeof adapter.requiresOverwrite !== "function") {
    return {
      requiresOverwrite: false,
      existingFiles: [],
    };
  }

  return adapter.requiresOverwrite(options);
}

async function uninstallHostHooks(hostName, options = {}) {
  const adapter = getHostAdapter(hostName);
  if (typeof adapter.uninstallHooks !== "function") {
    throw new SLAError(`Host '${hostName}' does not support hook uninstallation.`, {
      code: "HOST_HOOK_UNINSTALL_NOT_SUPPORTED",
      exitCode: 2,
    });
  }

  return adapter.uninstallHooks(options);
}

async function listHosts() {
  const config = await requireConfig();
  const hosts = [];

  for (const adapter of getSupportedHosts()) {
    hosts.push(await adapter.getStatus(config));
  }

  return { hosts };
}

function createCodexAdapter() {
  const skills = buildHostSkillDefinitions("codex");

  return {
    name: "codex",
    async requiresOverwrite(options = {}) {
      const existingFiles = [];
      const hookTarget = await resolveCodexHookTarget(options);

      for (const skill of skills) {
        const skillPath = getCodexSkillPath(skill.key);
        const markdownPath = `${skillPath}/SKILL.md`;
        const agentPath = getCodexAgentPath(skill.key);

        if (await pathExists(markdownPath)) {
          existingFiles.push(markdownPath);
        }

        if (await pathExists(agentPath)) {
          existingFiles.push(agentPath);
        }
      }

      for (const hookPath of [hookTarget.stopHookPath, hookTarget.sessionStartHookPath]) {
        if (await pathExists(hookPath)) {
          existingFiles.push(hookPath);
        }
      }

      if (await pathExists(hookTarget.persistenceReviewAgentPath)) {
        existingFiles.push(hookTarget.persistenceReviewAgentPath);
      }

      return {
        requiresOverwrite: existingFiles.length > 0,
        existingFiles,
      };
    },
    async install(options = {}) {
      const installPath = getCodexSkillsPath();
      const createdFiles = [];
      const updatedFiles = [];
      const unchangedFiles = [];
      const hookTarget = await resolveCodexHookTarget(options);

      await ensureDirectory(installPath);

      for (const skill of skills) {
        const skillPath = getCodexSkillPath(skill.key);
        const markdownPath = `${skillPath}/SKILL.md`;
        const agentPath = getCodexAgentPath(skill.key);

        await ensureDirectory(skillPath);
        await ensureDirectory(`${skillPath}/agents`);

        await writeTrackedFile(markdownPath, skill.skillMarkdown, {
          createdFiles,
          updatedFiles,
          unchangedFiles,
        });
        await writeTrackedFile(agentPath, renderOpenAIYaml(skill), {
          createdFiles,
          updatedFiles,
          unchangedFiles,
        });
      }

      await ensureDirectory(hookTarget.hooksPath);
      await writeTrackedFile(hookTarget.stopHookPath, renderCodexStopHookScript(), {
        createdFiles,
        updatedFiles,
        unchangedFiles,
      });
      await writeTrackedFile(hookTarget.sessionStartHookPath, renderCodexSessionStartHookScript(process.argv[1]), {
        createdFiles,
        updatedFiles,
        unchangedFiles,
      });
      await ensureDirectory(path.dirname(hookTarget.persistenceReviewAgentPath));
      await writeTrackedFile(hookTarget.persistenceReviewAgentPath, renderCodexPersistenceReviewAgent(), {
        createdFiles,
        updatedFiles,
        unchangedFiles,
      });
      const hooksWriteResult = await writeCodexHooksConfig(hookTarget);
      createdFiles.push(...hooksWriteResult.createdFiles);
      updatedFiles.push(...hooksWriteResult.updatedFiles);
      unchangedFiles.push(...hooksWriteResult.unchangedFiles);

      if (options.gitignore && hookTarget.scope === "repository" && hookTarget.repositoryPath) {
        const gitignoreResult = await ensureRepositoryCodexGitignore(hookTarget.repositoryPath);
        createdFiles.push(...gitignoreResult.createdFiles);
        updatedFiles.push(...gitignoreResult.updatedFiles);
        unchangedFiles.push(...gitignoreResult.unchangedFiles);
      }

      return {
        installPath,
        hooksConfigPath: hookTarget.hooksConfigPath,
        stopHookPath: hookTarget.stopHookPath,
        sessionStartHookPath: hookTarget.sessionStartHookPath,
        persistenceReviewAgentPath: hookTarget.persistenceReviewAgentPath,
        persistenceActivityPath: getPersistenceActivityPath(),
        hookScope: hookTarget.scope,
        repositoryPath: hookTarget.repositoryPath,
        installedSkills: HOST_SKILL_COMMANDS,
        createdFiles,
        updatedFiles,
        unchangedFiles,
        configEntry: {
          available: true,
          installed: true,
          installPath,
          hooksConfigPath: hookTarget.hooksConfigPath,
          stopHookPath: hookTarget.stopHookPath,
          sessionStartHookPath: hookTarget.sessionStartHookPath,
          persistenceReviewAgentPath: hookTarget.persistenceReviewAgentPath,
          persistenceActivityPath: getPersistenceActivityPath(),
          hookScope: hookTarget.scope,
          repositoryPath: hookTarget.repositoryPath,
          installedAt: new Date().toISOString(),
          installedSkills: HOST_SKILL_COMMANDS,
        },
      };
    },
    async getStatus(config) {
      const hostConfig = config.hosts?.codex || {};
      const installedSkills = hostConfig.installedSkills || HOST_SKILL_COMMANDS;
      const hookTarget = await resolveConfiguredCodexHookTarget(hostConfig);
      const installed = await isCodexHostInstalled(hookTarget, skills);
      const installPath = installed ? hostConfig.installPath || getCodexSkillsPath() : hostConfig.installPath || null;

      return {
        host: "codex",
        available: true,
        installed,
        installPath,
        hooksConfigPath: installed ? hookTarget.hooksConfigPath : hostConfig.hooksConfigPath || null,
        stopHookPath: installed ? hookTarget.stopHookPath : hostConfig.stopHookPath || null,
        sessionStartHookPath: installed ? hookTarget.sessionStartHookPath : hostConfig.sessionStartHookPath || null,
        persistenceReviewAgentPath: installed
          ? hookTarget.persistenceReviewAgentPath
          : hostConfig.persistenceReviewAgentPath || null,
        persistenceActivityPath: getPersistenceActivityPath(),
        hookScope: installed ? hookTarget.scope : hostConfig.hookScope || null,
        repositoryPath: installed ? hookTarget.repositoryPath : hostConfig.repositoryPath || null,
        installedSkills,
        installedAt: installed ? hostConfig.installedAt || null : null,
      };
    },
    async uninstallHooks(options = {}) {
      const hookTarget = await resolveCodexHookTarget(options);
      const removedFiles = [];
      for (const hookPath of [
        hookTarget.stopHookPath,
        hookTarget.sessionStartHookPath,
        hookTarget.persistenceReviewAgentPath,
      ]) {
        if (await pathExists(hookPath)) {
          await fs.unlink(hookPath);
          removedFiles.push(hookPath);
        }
      }
      const configResult = await removeManagedCodexHooksConfig(hookTarget);
      return {
        host: "codex",
        hooksConfigPath: hookTarget.hooksConfigPath,
        hookScope: hookTarget.scope,
        repositoryPath: hookTarget.repositoryPath,
        removedFiles: [...removedFiles, ...configResult.removedFiles],
        updatedFiles: configResult.updatedFiles,
        unchangedFiles: configResult.unchangedFiles,
      };
    },
  };
}

function createClaudeAdapter() {
  const skills = buildHostSkillDefinitions("claude");

  return {
    name: "claude",
    async requiresOverwrite(options = {}) {
      const existingFiles = [];
      const hookTarget = await resolveClaudeHookTarget(options);

      for (const skill of skills) {
        const markdownPath = `${getClaudeSkillPath(skill.key)}/SKILL.md`;
        if (await pathExists(markdownPath)) {
          existingFiles.push(markdownPath);
        }
      }

      if (await pathExists(hookTarget.stopHookPath)) {
        existingFiles.push(hookTarget.stopHookPath);
      }

      return { requiresOverwrite: existingFiles.length > 0, existingFiles };
    },
    async install(options = {}) {
      const installPath = getClaudeSkillsPath();
      const createdFiles = [];
      const updatedFiles = [];
      const unchangedFiles = [];
      const hookTarget = await resolveClaudeHookTarget(options);

      await ensureDirectory(installPath);
      for (const skill of skills) {
        const skillPath = getClaudeSkillPath(skill.key);
        const markdownPath = `${skillPath}/SKILL.md`;
        await ensureDirectory(skillPath);
        await writeTrackedFile(markdownPath, skill.skillMarkdown, { createdFiles, updatedFiles, unchangedFiles });
      }

      await ensureDirectory(hookTarget.hooksPath);
      await writeTrackedFile(hookTarget.stopHookPath, renderClaudeStopHookScript(), {
        createdFiles, updatedFiles, unchangedFiles,
      });
      const settingsWriteResult = await writeClaudeSettings(hookTarget);
      createdFiles.push(...settingsWriteResult.createdFiles);
      updatedFiles.push(...settingsWriteResult.updatedFiles);
      unchangedFiles.push(...settingsWriteResult.unchangedFiles);

      if (options.gitignore && hookTarget.scope === "repository" && hookTarget.repositoryPath) {
        const gitignoreResult = await ensureRepositoryClaudeGitignore(hookTarget.repositoryPath);
        createdFiles.push(...gitignoreResult.createdFiles);
        updatedFiles.push(...gitignoreResult.updatedFiles);
        unchangedFiles.push(...gitignoreResult.unchangedFiles);
      }

      return {
        installPath, hooksConfigPath: hookTarget.hooksConfigPath, stopHookPath: hookTarget.stopHookPath,
        hookScope: hookTarget.scope, repositoryPath: hookTarget.repositoryPath,
        installedSkills: HOST_SKILL_COMMANDS, createdFiles, updatedFiles, unchangedFiles,
        configEntry: {
          available: true, installed: true, installPath, hooksConfigPath: hookTarget.hooksConfigPath,
          stopHookPath: hookTarget.stopHookPath, hookScope: hookTarget.scope,
          repositoryPath: hookTarget.repositoryPath, installedAt: new Date().toISOString(),
          installedSkills: HOST_SKILL_COMMANDS,
        },
      };
    },
    async getStatus(config) {
      const hostConfig = config.hosts?.claude || {};
      const installedSkills = hostConfig.installedSkills || HOST_SKILL_COMMANDS;
      const hookTarget = await resolveConfiguredClaudeHookTarget(hostConfig);
      const installed = await isClaudeHostInstalled(hookTarget, skills);
      return {
        host: "claude", available: true, installed,
        installPath: installed ? hostConfig.installPath || getClaudeSkillsPath() : hostConfig.installPath || null,
        hooksConfigPath: installed ? hookTarget.hooksConfigPath : hostConfig.hooksConfigPath || null,
        stopHookPath: installed ? hookTarget.stopHookPath : hostConfig.stopHookPath || null,
        hookScope: installed ? hookTarget.scope : hostConfig.hookScope || null,
        repositoryPath: installed ? hookTarget.repositoryPath : hostConfig.repositoryPath || null,
        installedSkills, installedAt: installed ? hostConfig.installedAt || null : null,
      };
    },
  };
}

function createCursorAdapter() {
  const skills = buildHostSkillDefinitions("cursor");

  return {
    name: "cursor",
    async requiresOverwrite(options = {}) {
      const existingFiles = [];
      const hookTarget = await resolveCursorHookTarget(options);

      for (const skill of skills) {
        const markdownPath = `${getCursorSkillPath(skill.key)}/SKILL.md`;
        if (await pathExists(markdownPath)) {
          existingFiles.push(markdownPath);
        }
      }

      if (await pathExists(hookTarget.stopHookPath)) {
        existingFiles.push(hookTarget.stopHookPath);
      }

      return {
        requiresOverwrite: existingFiles.length > 0,
        existingFiles,
      };
    },
    async install(options = {}) {
      const installPath = getCursorSkillsPath();
      const createdFiles = [];
      const updatedFiles = [];
      const unchangedFiles = [];
      const hookTarget = await resolveCursorHookTarget(options);

      await ensureDirectory(installPath);

      for (const skill of skills) {
        const skillPath = getCursorSkillPath(skill.key);
        const markdownPath = `${skillPath}/SKILL.md`;
        await ensureDirectory(skillPath);
        await writeTrackedFile(markdownPath, skill.skillMarkdown, {
          createdFiles,
          updatedFiles,
          unchangedFiles,
        });
      }

      await ensureDirectory(hookTarget.hooksPath);
      await writeTrackedFile(hookTarget.stopHookPath, renderCursorStopHookScript(), {
        createdFiles,
        updatedFiles,
        unchangedFiles,
      });

      const hooksWriteResult = await writeCursorHooksConfig(hookTarget);
      createdFiles.push(...hooksWriteResult.createdFiles);
      updatedFiles.push(...hooksWriteResult.updatedFiles);
      unchangedFiles.push(...hooksWriteResult.unchangedFiles);

      if (options.gitignore && hookTarget.scope === "repository" && hookTarget.repositoryPath) {
        const gitignoreResult = await ensureRepositoryCursorGitignore(hookTarget.repositoryPath);
        createdFiles.push(...gitignoreResult.createdFiles);
        updatedFiles.push(...gitignoreResult.updatedFiles);
        unchangedFiles.push(...gitignoreResult.unchangedFiles);
      }

      return {
        installPath,
        hooksConfigPath: hookTarget.hooksConfigPath,
        stopHookPath: hookTarget.stopHookPath,
        hookScope: hookTarget.scope,
        repositoryPath: hookTarget.repositoryPath,
        installedSkills: HOST_SKILL_COMMANDS,
        createdFiles,
        updatedFiles,
        unchangedFiles,
        configEntry: {
          available: true,
          installed: true,
          installPath,
          hooksConfigPath: hookTarget.hooksConfigPath,
          stopHookPath: hookTarget.stopHookPath,
          hookScope: hookTarget.scope,
          repositoryPath: hookTarget.repositoryPath,
          installedAt: new Date().toISOString(),
          installedSkills: HOST_SKILL_COMMANDS,
        },
      };
    },
    async getStatus(config) {
      const hostConfig = config.hosts?.cursor || {};
      const installedSkills = hostConfig.installedSkills || HOST_SKILL_COMMANDS;
      const hookTarget = await resolveConfiguredCursorHookTarget(hostConfig);
      const installed = await isCursorHostInstalled(hookTarget, skills);
      const installPath = installed ? hostConfig.installPath || getCursorSkillsPath() : hostConfig.installPath || null;

      return {
        host: "cursor",
        available: true,
        installed,
        installPath,
        hooksConfigPath: installed ? hookTarget.hooksConfigPath : hostConfig.hooksConfigPath || null,
        stopHookPath: installed ? hookTarget.stopHookPath : hostConfig.stopHookPath || null,
        hookScope: installed ? hookTarget.scope : hostConfig.hookScope || null,
        repositoryPath: installed ? hookTarget.repositoryPath : hostConfig.repositoryPath || null,
        installedSkills,
        installedAt: installed ? hostConfig.installedAt || null : null,
      };
    },
  };
}

function createHermesAdapter() {
  const skills = buildHostSkillDefinitions("hermes");

  return {
    name: "hermes",
    async requiresOverwrite(options = {}) {
      ensureHermesModeRequested();
      const config = await requireHermesConfig();
      const profile = await resolveHermesInstallProfile(config, options);
      const existingFiles = [];

      for (const skill of skills) {
        const markdownPath = path.join(
          getSkillPath(profile, skill.key, { category: "general" }),
          "SKILL.md",
        );
        if (await pathExists(markdownPath)) {
          existingFiles.push(markdownPath);
        }
      }

      return {
        requiresOverwrite: existingFiles.length > 0,
        existingFiles,
      };
    },
    async install(options = {}, config) {
      ensureHermesModeRequested();
      const hermesConfig = ensureHermesConfig(config);
      const profile = await resolveHermesInstallProfile(hermesConfig, options);
      const installPath = getSkillsPath(profile);
      const createdFiles = [];
      const updatedFiles = [];
      const unchangedFiles = [];

      await ensureDirectory(installPath);

      for (const skill of skills) {
        const skillPath = getSkillPath(profile, skill.key, { category: "general" });
        const markdownPath = path.join(skillPath, "SKILL.md");
        await ensureDirectory(skillPath);
        await ensureManagedSkillSubdirectories(skillPath);
        await writeTrackedFile(markdownPath, skill.skillMarkdown, {
          createdFiles,
          updatedFiles,
          unchangedFiles,
        });
      }

      return {
        installPath,
        profile,
        installedSkills: HOST_SKILL_COMMANDS,
        createdFiles,
        updatedFiles,
        unchangedFiles,
        configEntry: {
          available: true,
          installed: true,
          installPath,
          profile,
          installedAt: new Date().toISOString(),
          installedSkills: HOST_SKILL_COMMANDS,
        },
      };
    },
    async getStatus(config) {
      const hostConfig = config.hosts?.hermes || {};
      const profile = hostConfig.profile || null;
      const installPath = profile ? getSkillsPath(profile) : hostConfig.installPath || null;
      const installedSkills = hostConfig.installedSkills || HOST_SKILL_COMMANDS;
      const installed = profile ? await isHermesHostInstalled(profile, skills) : false;

      return {
        host: "hermes",
        available: true,
        installed,
        installPath,
        hooksConfigPath: null,
        stopHookPath: null,
        hookScope: null,
        repositoryPath: null,
        profile,
        installedSkills,
        installedAt: installed ? hostConfig.installedAt || null : null,
      };
    },
  };
}

function buildHostSkillDefinitions(host) {
  return [
    {
      key: "sla-use-profile",
      command: "/use-profile",
      shortDescription: "Work inside a chosen sla profile",
      defaultPrompt: "Use $sla-use-profile to set and use the requested sla profile: <task>.",
      skillMarkdown: renderUseProfileSkillMarkdown(host),
    },
    {
      key: "sla-create-profile",
      command: "/create-profile",
      shortDescription: "Create a new sla profile through the CLI",
      defaultPrompt: "Use $sla-create-profile to create an sla profile for this request: <task>.",
      skillMarkdown: renderCreateProfileSkillMarkdown(host),
    },
    {
      key: "sla-update-profile",
      command: "/update-profile",
      shortDescription: "Update an sla profile through the CLI",
      defaultPrompt: "Use $sla-update-profile to update an sla profile for this request: <task>.",
      skillMarkdown: renderUpdateProfileSkillMarkdown(host),
    },
  ];
}

function renderUseProfileSkillMarkdown(host) {
  if (host === "hermes") {
    return `---
name: sla-use-profile
description: Use \`sla\` commands to switch the session to a named profile and keep later work scoped to it.
---

# Use Profile

## Overview

Use this skill when the user asks to work inside a specific \`sla\` profile managed in Hermes storage. Hermes profiles live under \`~/.hermes/profiles/<profile>/\`, and reusable skills live under category-aware paths such as \`skills/general/deploy/\`.

## Workflow

1. Determine the exact profile name from the user request. If no exact name is available, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
2. Run \`sla --hermes-agent profile dir <name>\` to verify the profile exists and capture its absolute path.
3. Always run \`sla --hermes-agent profile context <name> --json\` for the provided profile. This is required and not optional.
4. Treat that returned snapshot as the active profile context for the session.
5. Use \`sla --hermes-agent soul view <name>\` when you need the profile's purpose, constraints, or top-level identity as written in \`SOUL.md\`.
6. Use \`sla --hermes-agent memory list <name>\` or \`sla --hermes-agent memory view <name> --target memory|user\` when you need durable facts, preferences, or user-specific context.
7. Use \`sla --hermes-agent skill list <name>\` when you need the skill catalog. Hermes skill identifiers include category prefixes such as \`general/deploy\`.
8. Use \`sla --hermes-agent skill view <skill> <name> --category <category>\` when you need a full skill body. If no category is provided, Hermes uses \`general\`.
9. Treat persistence review as mandatory before you finish the task or end the turn.
10. Persist durable facts, constraints, environment notes, and stable preferences with \`sla --hermes-agent memory add|replace|remove\`.
11. Persist reusable repo/domain/task capabilities with \`sla --hermes-agent skill create|edit|delete --category <category>\`. Use \`general\` unless the user or existing skill layout clearly calls for another category.
12. Keep \`SKILL.md\` action-oriented and procedural. Put deeper supporting context in \`references/*.md\` under the relevant category-aware skill directory.
13. Create or update reference docs with \`sla --hermes-agent skill create-reference <skill> <name> --category <category> --path <file>.md --title "<Title>"\` or \`sla --hermes-agent skill write-file <skill> <name> --category <category> --subdir references --path <file>.md\`.
14. If you cannot tell whether new information belongs in memory, user memory, or a skill, run \`sla --hermes-agent profile classify <name> --stdin\` or \`--file\` before writing anything.
15. State that the session is now operating against that Hermes profile and keep subsequent \`sla --hermes-agent\` commands scoped to it until the user changes profiles again.

## Operating Rules

- Prefer \`sla --hermes-agent\` commands over direct filesystem edits for anything under \`~/.hermes/profiles/<profile>/\`.
- Facts and stable preferences belong in \`sla memory\`.
- Reusable operational knowledge belongs in \`sla skill\`.
- Hermes skills are category-aware and default to \`general\` when no category is supplied.
- Keep rich supporting context in \`references/*.md\` inside the relevant category-aware skill directory.
- Hermes does not provide hook-driven persistence. Do the persistence review explicitly before you finish the task.
- Do not guess profile names.
- If the profile lookup fails or the user request is ambiguous, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
`;
  }

  return `---
name: sla-use-profile
description: Use \`sla\` commands to switch the session to a named profile and keep later work scoped to it.
---

# Use Profile

## Overview

Use this skill when the user explicitly asks to switch to or add a specific \`sla\` profile. In a repository with a \`.sla\` manifest, Codex SessionStart already loads the selected profile context by default; use this skill only for an intentional override.

## Workflow

1. Determine the exact profile name from the user request. If no exact name is available, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
2. Run \`sla profile dir <name>\` to verify the profile exists and capture its absolute path.
3. Run \`sla profile context <name> --json\` to load the explicit override's snapshot.
4. Treat that returned snapshot as the active profile context for the session. If a repository manifest already supplied profiles, keep later \`sla\` commands scoped to the correct profile.
5. Use \`sla soul view <name>\` when you need the profile's purpose, constraints, or top-level identity as written in \`SOUL.md\`.
6. Use \`sla memory list <name>\` or \`sla memory view <name> --target memory|user\` when you need durable facts, preferences, or user-specific context. Use \`list\` for the full current memory contents and \`view\` for one target.
7. Use \`sla skill list <name>\` when you need the skill catalog. It is the compact index only.
8. Use \`sla skill view <skill> <name>\` only when one of the listed skills is relevant and you need the full skill body before acting. Loading full skills depends on the task, but the profile context does not.
9. Use \`sla stats profile <name>\` when you need activity or usage context, not for the core profile content itself.
10. Persist durable facts, constraints, environment notes, and stable preferences only when the user asks for a change, with explicit \`sla memory\` arguments:
    - Add: \`sla memory add <profile> --target memory|user --entry "<durable fact>"\`.
    - Replace: \`sla memory replace <profile> --target memory|user --match "<existing entry>" --entry "<replacement>"\`.
    - Remove: \`sla memory remove <profile> --target memory|user --match "<existing entry>"\`.
11. Persist reusable repo/domain/task capabilities with \`sla skill\` when requested. Create a scaffold with \`sla skill create <skill> [profile]\`; then write or replace its body with \`sla skill edit <skill> [profile] --file <SKILL.md>\` or by piping content to \`sla skill edit <skill> [profile] --stdin\`. Delete only when intended, using \`sla skill delete <skill> [profile] --yes\`.
12. If you cannot tell whether new information belongs in memory, user memory, or a skill, run \`sla profile classify <name> --stdin\` or \`--file\` before writing anything.
13. State that the session is now operating against that profile and keep subsequent \`sla\` commands scoped to it until the user changes profiles again.

## Operating Rules

- Prefer \`sla\` commands over direct filesystem edits for anything under \`~/.sla\`.
- Facts and stable preferences belong in \`sla memory\`.
- Reusable operational knowledge belongs in \`sla skill\`: anything an agent should reuse later as a guide for working in the same repo, domain, system, or recurring task family.
- Use skills for capabilities such as implementation workflows, debugging approaches, deploy/release runbooks, repo maps, environment matrices, integration patterns, file/entrypoint guides, and decision rules.
- Keep rich supporting context in \`references/*.md\` inside the relevant skill directory when it is too detailed for \`SKILL.md\` or is supporting analysis rather than the main workflow.
- Persist only durable knowledge; do not store turn-local or obviously temporary notes unless the user explicitly asks.
- Do not generate a persistence-review continuation at end of turn; SessionStart only establishes context.
- Use \`sla profile context\` for an explicit profile override, then load more detail only when the current task needs it.
- Do not treat the compact skill index as full skill content.
- Do not guess profile names.
- If the profile lookup fails or the user request is ambiguous, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
`;
}

function renderCreateProfileSkillMarkdown(host) {
  if (host === "hermes") {
    return `---
name: sla-create-profile
description: Create a new \`sla\` profile and capture explicit user intent with CLI commands.
---

# Create Profile

## Overview

Use this skill when the user wants a new \`sla\` profile stored in Hermes. Hermes profile state persists under \`~/.hermes/profiles/<profile>/\`.

## Workflow

1. Identify the exact profile name and the user-provided purpose for the profile. If either is missing, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
2. Run \`sla --hermes-agent profile create <name>\` to scaffold the profile.
3. Run \`sla --hermes-agent soul edit <name> --stdin\` or \`sla --hermes-agent soul edit <name> --file <path>\` to write the user-approved \`SOUL.md\` content.
4. Add durable facts with \`sla --hermes-agent memory add <name> --target memory|user --entry "..."\` only when the user has explicitly provided them.
5. If the content might be a reusable workflow instead of a fact, run \`sla --hermes-agent profile classify <name> --stdin\` or \`--file\` before deciding whether to write memory or create a skill.
6. When you create Hermes skills for the profile, write them with \`--category <name>\`; omit the option only when the default \`general\` category is correct.
7. Confirm the created profile name and path by using CLI output rather than describing the filesystem from memory.

## Operating Rules

- Do not synthesize profile intent beyond what the user explicitly states.
- Store facts and stable preferences in memory; store reusable procedures as skills.
- Prefer \`sla --hermes-agent\` commands over direct filesystem edits for \`~/.hermes/profiles/<profile>/\`.
- Hermes skills persist under \`skills/<category>/<skill>/\`, with \`general\` as the default category.
- If the required name or purpose is missing, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
`;
  }

  return `---
name: sla-create-profile
description: Create a new \`sla\` profile and capture explicit user intent with CLI commands.
---

# Create Profile

## Overview

Use this skill when the user wants a new \`sla\` profile.

## Workflow

1. Identify the exact profile name and the user-provided purpose for the profile. If either is missing, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
2. Run \`sla profile create <name>\` to scaffold the profile.
3. Run \`sla soul edit <name> --stdin\` or \`sla soul edit <name> --file <path>\` to write the user-approved \`SOUL.md\` content.
4. Add durable facts with \`sla memory add <name> --target memory|user --entry "..."\` only when the user has explicitly provided them.
5. If the content might be a reusable workflow instead of a fact, run \`sla profile classify <name> --stdin\` or \`--file\` before deciding whether to write memory or create a skill.
6. Confirm the created profile name and path by using CLI output rather than describing the filesystem from memory.

## Operating Rules

- Do not synthesize profile intent beyond what the user explicitly states.
- Store facts and stable preferences in memory; store reusable procedures as skills.
- Prefer \`sla\` commands over direct filesystem edits for \`~/.sla\`.
- If the required name or purpose is missing, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
`;
}

function renderUpdateProfileSkillMarkdown(host) {
  if (host === "hermes") {
    return `---
name: sla-update-profile
description: Update an existing \`sla\` profile by using CLI commands for soul, memory, and skill maintenance.
---

# Update Profile

## Overview

Use this skill when the user wants to change a Hermes-backed profile's \`SOUL.md\`, memories, or installed skills.

## Workflow

1. Resolve the target profile exactly. If it is omitted, use \`sla --hermes-agent profile get-default\`; if that still leaves the task ambiguous, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
2. Inspect current state with \`sla --hermes-agent profile context <name> --json\`, \`sla --hermes-agent skill view <skill> <name> --category <category>\`, or \`sla --hermes-agent stats profile <name>\` before changing anything material.
3. If the requested change could be either a fact or a reusable workflow, run \`sla --hermes-agent profile classify <name> --stdin\` or \`--file\` before writing anything.
4. Apply updates with the relevant \`sla --hermes-agent\` commands such as \`soul edit\`, \`memory add|replace|remove\`, or \`skill create|edit|delete|write-file|remove-file --category <category>\`.
5. Use \`general\` when a Hermes skill category is not specified and there is no stronger existing category convention.
6. Report the concrete CLI-backed changes and keep future work scoped to that same profile unless the user changes targets.

## Operating Rules

- Do not edit \`~/.hermes/profiles/<profile>/\` directly when an \`sla --hermes-agent\` command exists.
- Store facts and stable preferences in memory; store reusable procedures as skills.
- Place Hermes skills under \`skills/<category>/<skill>/\` and use \`--category\` when writing or editing them.
- Do not guess missing profile names or missing content.
- If the target profile or requested update is unclear, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
`;
  }

  return `---
name: sla-update-profile
description: Update an existing \`sla\` profile by using CLI commands for soul, memory, and skill maintenance.
---

# Update Profile

## Overview

Use this skill when the user wants to change a profile's \`SOUL.md\`, memories, or installed skills.

## Workflow

1. Resolve the target profile exactly. If it is omitted, use \`sla profile get-default\`; if that still leaves the task ambiguous, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
2. Inspect current state with \`sla profile context <name> --json\`, \`sla skill view <skill> <name>\`, or \`sla stats profile <name>\` before changing anything material.
3. If the requested change could be either a fact or a reusable workflow, run \`sla profile classify <name> --stdin\` or \`--file\` before writing anything.
4. Apply updates with the relevant \`sla\` commands such as \`sla soul edit\`, \`sla memory add|replace|remove\`, \`sla skill create|edit|delete\`, or \`sla skill write-file|remove-file\`.
5. Report the concrete CLI-backed changes and keep future work scoped to that same profile unless the user changes targets.

## Operating Rules

- Do not edit \`~/.sla\` directly when an \`sla\` command exists.
- Store facts and stable preferences in memory; store reusable procedures as skills.
- Do not guess missing profile names or missing content.
- If the target profile or requested update is unclear, say: \`No SLA profile was provided, and no matching profile could be resolved.\`
`;
}

async function isCodexHostInstalled(hookTarget, skills) {
  for (const skill of skills) {
    const skillPath = getCodexSkillPath(skill.key);
    if (!(await pathExists(`${skillPath}/SKILL.md`))) {
      return false;
    }

    if (!(await pathExists(getCodexAgentPath(skill.key)))) {
      return false;
    }
  }

  if (!(await pathExists(hookTarget.stopHookPath)) || !(await pathExists(hookTarget.sessionStartHookPath))) {
    return false;
  }

  if (!(await pathExists(hookTarget.persistenceReviewAgentPath))) {
    return false;
  }

  if (!(await pathExists(hookTarget.hooksConfigPath))) {
    return false;
  }

  const config = await readJsonIfExists(hookTarget.hooksConfigPath, "codex");
  return hasManagedCodexStopHook(config, hookTarget) && hasManagedCodexSessionStartHook(config, hookTarget);
}

async function isCursorHostInstalled(hookTarget, skills) {
  for (const skill of skills) {
    if (!(await pathExists(`${getCursorSkillPath(skill.key)}/SKILL.md`))) {
      return false;
    }
  }

  if (!(await pathExists(hookTarget.stopHookPath))) {
    return false;
  }

  if (!(await pathExists(hookTarget.hooksConfigPath))) {
    return false;
  }

  const config = await readJsonIfExists(hookTarget.hooksConfigPath, "cursor");
  return hasManagedCursorStopHook(config, hookTarget);
}

async function isClaudeHostInstalled(hookTarget, skills) {
  for (const skill of skills) {
    if (!(await pathExists(`${getClaudeSkillPath(skill.key)}/SKILL.md`))) {
      return false;
    }
  }

  if (!(await pathExists(hookTarget.stopHookPath)) || !(await pathExists(hookTarget.hooksConfigPath))) {
    return false;
  }

  return hasManagedClaudeStopHook(await readJsonIfExists(hookTarget.hooksConfigPath, "claude"), hookTarget);
}

async function isHermesHostInstalled(profile, skills) {
  for (const skill of skills) {
    const markdownPath = path.join(getSkillPath(profile, skill.key, { category: "general" }), "SKILL.md");
    if (!(await pathExists(markdownPath))) {
      return false;
    }
  }

  return true;
}

function renderOpenAIYaml(skill) {
  return [
    "interface:",
    `  display_name: "${skill.command}"`,
    `  short_description: "${skill.shortDescription}"`,
    `  default_prompt: "${skill.defaultPrompt}"`,
    "",
  ].join("\n");
}

function renderCodexSessionStartHookScript(slaCliPath) {
  return [
    "#!/usr/bin/env node",
    "",
    'const fs = require("node:fs");',
    'const { spawnSync } = require("node:child_process");',
    "",
    "const raw = fs.readFileSync(0, \"utf8\").trim();",
    "if (!raw) process.exit(0);",
    "",
    "let payload;",
    "try {",
    "  payload = JSON.parse(raw);",
    "} catch (_error) {",
    "  process.exit(0);",
    "}",
    "",
    "if (!payload || typeof payload !== \"object\" || typeof payload.cwd !== \"string\" || !payload.cwd) {",
    "  process.exit(0);",
    "}",
    "",
    "const result = spawnSync(process.execPath, [" + JSON.stringify(slaCliPath) + ", \"session\", \"bootstrap\", payload.cwd, \"--json\"], {",
    "  encoding: \"utf8\",",
    "  env: process.env,",
    "});",
    "",
    "if (result.error || result.status !== 0) process.exit(0);",
    "",
    "let bootstrap;",
    "try {",
    "  bootstrap = JSON.parse(result.stdout);",
    "} catch (_error) {",
    "  process.exit(0);",
    "}",
    "",
    "if (!bootstrap?.ok || !bootstrap.data?.found || !Array.isArray(bootstrap.data.profiles)) process.exit(0);",
    "",
    "const profiles = bootstrap.data.profiles;",
    "if (!profiles.length || profiles.some((entry) => typeof entry?.profile !== \"string\" || typeof entry?.renderedContext !== \"string\")) process.exit(0);",
    "",
    "const names = profiles.map((entry) => entry.profile);",
    "const policy = [",
    "  \"# SLA Repository Profiles: \" + names.join(\", \"),",
    "",
    "  \"The named profiles are active for this repository. Scope every later sla operation to the correct active profile: \" + names.join(\", \") + \".\",",
    "  \"The injected profile snapshots already contain SOUL, durable memory and user-memory entries, plus a compact skill index.\",",
    "  \"Use sla soul view <profile> or sla memory list <profile> / sla memory view <profile> only when you need a fresher or more specific view.\",",
    "  \"The skill index is not the full skill body. Before relying on a listed skill relevant to the task, run sla skill view <skill> <profile>.\",",
    "  \"Use sla stats profile <profile> only for activity or usage information, and sla profile classify <profile> when a later persistence target is ambiguous.\",",
    "  \"Change SLA-managed data through sla commands rather than direct edits under ~/.sla.\",",
    "].join(\"\\n\");",
    "",
    "const additionalContext = [policy, ...profiles.map((entry) => entry.renderedContext.trim())].join(\"\\n\\n\");",
    "process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: \"SessionStart\", additionalContext } }) + \"\\n\");",
    "",
  ].join("\n");
}

function renderCodexStopHookScript() {
  return [
    "#!/usr/bin/env node",
    "",
    'const fs = require("node:fs");',
    "",
    "let payload;",
    "try {",
    "  payload = JSON.parse(fs.readFileSync(0, \"utf8\"));",
    "} catch (_error) {",
    "  process.exit(0);",
    "}",
    "",
    "if (!payload || typeof payload !== \"object\" || payload.stop_hook_active) {",
    "  process.exit(0);",
    "}",
    "",
    "const response = {",
    '  decision: "block",',
    '  reason: "SLA persistence handoff: spawn exactly one `sla-persistence-review` subagent now. Do not announce the dispatch, narrate progress, or send a separate handoff message. Do not perform the review yourself. After the child returns, respond with exactly its one-line result and nothing else. If dispatch is unavailable, respond only: `SLA persistence review: profiles=none; failed: dispatch-unavailable.`",',
    "};",
    "",
    "process.stdout.write(`${JSON.stringify(response)}\\n`);",
    "",
  ].join("\n");
}

function renderCodexPersistenceReviewAgent() {
  return [
    `name = "${CODEX_PERSISTENCE_REVIEW_AGENT}"`,
    'description = "Dedicated SLA persistence-review subagent dispatched once when a Codex task completes."',
    'developer_instructions = """',
    "You are the SLA persistence-review subagent.",
    "",
    "Review only the forked session snapshot for durable SLA learning. Do not ask the parent to do the review and do not include the snapshot, detailed reasoning, credentials, tokens, or other secrets in your result. Do not announce that you are starting, dispatching, reviewing, or finishing; make any needed tool calls silently and return only the final completion line.",
    "",
    "## Profile scope and safety",
    "",
    "- Use only active profiles explicitly supplied in the parent session context, normally under `# SLA Repository Profiles:`. Never guess a profile or fall back to the SLA default.",
    "- If no active profile is safely resolved, make no write, record the outcome with `sla persistence record --outcome skipped`, and return `SLA persistence review: profiles=none; skipped: profile-unresolved.`",
    "- If several active profiles exist, route each candidate only to the profile it is specific to. Do not collapse profile-specific learning into another active profile. If the target remains ambiguous, skip that candidate.",
    "- Before a material update, inspect the selected profile through `sla profile context <profile> --json`; inspect an existing relevant skill with `sla skill view <skill> <profile>` when necessary.",
    "- Use only `sla` CLI commands for SLA-managed reads and writes. Never directly edit `~/.sla`, profile files, configuration, or generated skill files.",
    "",
    "## What to persist",
    "",
    "- Store durable declarative facts, stable constraints, and lasting preferences with `sla memory add <profile> --target memory|user --entry <text>`. Use `user` only for user-specific durable context.",
    "- Store reusable procedures, workflows, runbooks, checklists, decision trees, prompt recipes, and command sequences as skills. Use `sla skill create <skill> <profile>` and `sla skill edit <skill> <profile> --stdin` only when the procedure is genuinely reusable.",
    "- Put rich supporting material that would overburden `SKILL.md` in a relevant skill reference through `sla skill create-reference <skill> <profile> --path <name>.md --stdin`.",
    "- When classification is uncertain, run `sla profile classify <profile> --stdin` before writing. Do not use classification as permission to persist temporary material.",
    "- Skip turn-local notes, one-off todos, transient debugging details, temporary next steps, raw transcript material, and secrets.",
    "",
    "## Duplicate and failure handling",
    "",
    "- Compare a candidate with the selected profile's current memories and relevant skill before writing. Skip exact or materially duplicate content. Update an existing skill only for a material, durable improvement.",
    "- If a CLI write fails, do not retry blindly or repeat already-completed writes. Stop processing that candidate and surface a safe failure summary.",
    "- Before returning a final result, record it with `sla persistence record`. Use one `--profile <profile>` for every selected profile; use only the count flags, outcome, and a supported `--failure-reason` code. If the session gives you a stable dispatch identifier, pass it as `--event-id` so a retry records once. Never place transcript text, secrets, paths, or an arbitrary error message in the activity record.",
    "- If the activity record command itself fails, return `SLA persistence review: profiles=<comma-separated profiles>; failed: activity-record-failed.` without retrying blindly. Do not claim a fully successful audited review.",
    "",
    "## Completion contract",
    "",
    "Return exactly one concise line and no detailed reasoning:",
    "- Success with changes: first record `--outcome changed --memory <count> --skills <count> --references <count>`, then return `SLA persistence review: profiles=<comma-separated profiles>; memory=<count>; skills=<count>; references=<count>.`",
    "- No changes: first record `--outcome no-change`, then return `SLA persistence review: profiles=<comma-separated profiles>; no-change.`",
    "- Safe failure: first record `--outcome failed --failure-reason write-failed|dispatch-unavailable|activity-record-failed`, then return `SLA persistence review: profiles=<comma-separated profiles>; failed: <safe reason>.`",
    '\"\"\"',
    "",
  ].join("\n");
}

function renderCursorStopHookScript() {
  return [
    "#!/usr/bin/env node",
    "",
    'const fs = require("node:fs");',
    "",
    "const raw = fs.readFileSync(0, \"utf8\").trim();",
    "if (!raw) {",
    "  process.exit(0);",
    "}",
    "",
    "let payload;",
    "try {",
    "  payload = JSON.parse(raw);",
    "} catch (_error) {",
    "  process.exit(0);",
    "}",
    "",
    "if (!payload || typeof payload !== \"object\") {",
    "  process.exit(0);",
    "}",
    "",
    "if (payload.status !== \"completed\") {",
    "  process.exit(0);",
    "}",
    "",
    "const loopCount = Number.parseInt(String(payload.loop_count ?? 0), 10);",
    "if (Number.isFinite(loopCount) && loopCount !== 0) {",
    "  process.exit(0);",
    "}",
    "",
    "const profiles = collectProfilesFromTranscript(payload.transcript_path);",
    "const profileInstruction = profiles.length > 0",
    "  ? [",
    '      `Use the SLA profiles established in this session: ${profiles.join(\", \")}.`,',
    '      \"Persist durable memories and skills against the correct listed profile. If work spans multiple listed profiles, update each relevant one instead of collapsing everything into the default profile.\",',
    "    ].join(\"\\n\")",
    "  : \"If no explicit profile was established, use `sla profile get-default` and only continue if that is actually the right target; otherwise say `No SLA profile was provided, and no matching profile could be resolved.`;\";",
    "",
    "const response = {",
    '  followup_message: [',
    '    \"SLA -> Before stopping, review this session for durable SLA profile updates.\",',
    '    \"Use `sla` CLI commands, not direct edits under `~/.sla`.\",',
    "    profileInstruction,",
    '    \"Do a mandatory persistence review: identify any durable facts, reusable skill-worthy capabilities, or rich supporting reference material learned during the session.\",',
    '    \"Persist durable facts, constraints, environment notes, and stable preferences with `sla memory add`, `sla memory replace`, or `sla memory remove`.\",',
    '    \"Persist reusable repo/domain/task capabilities by creating or updating a skill with `sla skill` commands. Store a skill when the session produced guidance that should help an agent succeed again in the same codebase, system, or recurring task family, not just when you discovered a strict step-by-step procedure.\",',
    '    \"A skill is the right target for reusable operational guidance such as workflows, checklists, debugging playbooks, deploy/release runbooks, repo maps, environment rules, integration patterns, auth/routing rules, file-entrypoint guides, and similar recurring implementation knowledge.\",',
    '    \"Do not flatten that kind of reusable guidance into memory. Keep `SKILL.md` action-oriented: when to use the skill, how to proceed, the important commands/files, the decision points, and any concise operational context needed to execute correctly.\",',
    '    \"Put deep supporting context in `references/*.md` under the relevant skill directory.\",',
    '    \"Create or update reference docs for architecture notes, environment matrices, bug forensics, API shapes, file maps, and implementation plans with `sla skill create-reference <skill> <name> --path <file>.md --title \\\"<Title>\\\"` or `sla skill write-file <skill> <name> --subdir references --path <file>.md`.\",',
    '    \"If the storage target is ambiguous, run `sla profile classify <name> --stdin` or `--file` first. If the material clearly supports an existing skill without being a procedure itself, store it as a reference, not a memory entry.\",',
    '    \"Only store durable knowledge learned from the session. After any needed persistence work, finish the turn.\"',
    '  ].join("\\n")',
    "};",
    "",
    "process.stdout.write(`${JSON.stringify(response)}\\n`);",
    "",
    "function collectProfilesFromTranscript(transcriptPath) {",
    "  if (!transcriptPath) {",
    "    return [];",
    "  }",
    "",
    "  try {",
    "    const rawTranscript = fs.readFileSync(transcriptPath, \"utf8\");",
    "    const seen = new Set();",
    "    const profiles = [];",
    "",
    "    for (const line of rawTranscript.split(/\\r?\\n/)) {",
    "      if (!line.trim()) {",
    "        continue;",
    "      }",
    "",
    "      const entry = JSON.parse(line);",
    "      for (const text of extractTranscriptText(entry)) {",
    "        for (const profile of extractProfilesFromText(text)) {",
    "          if (seen.has(profile)) {",
    "            continue;",
    "          }",
    "",
    "          seen.add(profile);",
    "          profiles.push(profile);",
    "        }",
    "      }",
    "    }",
    "",
    "    return profiles;",
    "  } catch (_error) {",
    "    return [];",
    "  }",
    "}",
    "",
    "function extractTranscriptText(entry) {",
    "  const texts = [];",
    "  if (!entry || typeof entry !== \"object\") {",
    "    return texts;",
    "  }",
    "",
    "  if (typeof entry.prompt === \"string\") {",
    "    texts.push(entry.prompt);",
    "  }",
    "",
    "  const payload = entry && typeof entry === \"object\" ? entry.payload : null;",
    "  if (payload && typeof payload === \"object\") {",
    "    if (payload.type === \"message\" && payload.role === \"user\" && Array.isArray(payload.content)) {",
    "      for (const item of payload.content) {",
    "        if (item?.type === \"input_text\" && typeof item.text === \"string\") {",
    "          texts.push(item.text);",
    "        }",
    "      }",
    "    }",
    "",
    "    if (entry.type === \"event_msg\" && payload.type === \"user_message\" && typeof payload.message === \"string\") {",
    "      texts.push(payload.message);",
    "    }",
    "  }",
    "",
    "  return texts;",
    "}",
    "",
    "function extractProfilesFromText(text) {",
    "  const profiles = [];",
    "  for (const rawLine of text.split(/\\r?\\n/)) {",
    "    const line = rawLine.trim();",
    "    const match = line.match(/^(?:[-*]\\s+)?\\/use-profile\\s+([A-Za-z0-9][A-Za-z0-9._-]*)\\b/);",
    "    if (!match) {",
    "      continue;",
    "    }",
    "",
    "    profiles.push(match[1]);",
    "  }",
    "",
    "  return profiles;",
    "}",
    "",
  ].join("\n");
}

function renderClaudeStopHookScript() {
  return renderCodexStopHookScript();
}

async function writeCodexHooksConfig(hookTarget) {
  const configPath = hookTarget.hooksConfigPath;
  const existing = (await readJsonIfExists(configPath, "codex")) || {};
  const nextConfig = mergeCodexSessionStartHook(existing, hookTarget);
  const serialized = `${JSON.stringify(nextConfig, null, 2)}\n`;

  if (!(await pathExists(configPath))) {
    await writeFileAtomic(configPath, serialized);
    return {
      createdFiles: [configPath],
      updatedFiles: [],
      unchangedFiles: [],
    };
  }

  const current = await fs.readFile(configPath, "utf8");
  if (current === serialized) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [configPath],
    };
  }

  await writeFileAtomic(configPath, serialized);
  return {
    createdFiles: [],
    updatedFiles: [configPath],
    unchangedFiles: [],
  };
}

async function removeManagedCodexHooksConfig(hookTarget) {
  const configPath = hookTarget.hooksConfigPath;
  if (!(await pathExists(configPath))) {
    return { removedFiles: [], updatedFiles: [], unchangedFiles: [] };
  }

  const existing = await readJsonIfExists(configPath, "codex");
  const hooks = isPlainObject(existing.hooks) ? { ...existing.hooks } : {};
  for (const eventName of ["Stop", "SessionStart"]) {
    const entries = Array.isArray(hooks[eventName]) ? hooks[eventName].map(cloneHookEntry) : [];
    const filtered = entries
      .map((entry) => {
        if (!Array.isArray(entry?.hooks)) return entry;
        const remaining = entry.hooks.filter((hook) =>
          eventName === "Stop" ? !isManagedCodexStopHook(hook) : !isManagedCodexSessionStartHook(hook),
        );
        return remaining.length === entry.hooks.length ? entry : { ...entry, hooks: remaining };
      })
      .filter((entry) => !Array.isArray(entry?.hooks) || entry.hooks.length > 0);
    if (filtered.length > 0) hooks[eventName] = filtered;
    else delete hooks[eventName];
  }

  const next = { ...existing, hooks };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const current = await fs.readFile(configPath, "utf8");
  if (current === serialized) {
    return { removedFiles: [], updatedFiles: [], unchangedFiles: [configPath] };
  }
  await writeFileAtomic(configPath, serialized);
  return { removedFiles: [], updatedFiles: [configPath], unchangedFiles: [] };
}

async function writeCursorHooksConfig(hookTarget) {
  const configPath = hookTarget.hooksConfigPath;
  const existing = (await readJsonIfExists(configPath, "cursor")) || {};
  const nextConfig = mergeCursorStopHook(existing, hookTarget);
  const serialized = `${JSON.stringify(nextConfig, null, 2)}\n`;

  if (!(await pathExists(configPath))) {
    await writeFileAtomic(configPath, serialized);
    return {
      createdFiles: [configPath],
      updatedFiles: [],
      unchangedFiles: [],
    };
  }

  const current = await fs.readFile(configPath, "utf8");
  if (current === serialized) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [configPath],
    };
  }

  await writeFileAtomic(configPath, serialized);
  return {
    createdFiles: [],
    updatedFiles: [configPath],
    unchangedFiles: [],
  };
}

async function writeClaudeSettings(hookTarget) {
  const configPath = hookTarget.hooksConfigPath;
  const existing = (await readJsonIfExists(configPath, "claude")) || {};
  const nextConfig = mergeClaudeStopHook(existing, hookTarget);
  const serialized = `${JSON.stringify(nextConfig, null, 2)}\n`;

  if (!(await pathExists(configPath))) {
    await writeFileAtomic(configPath, serialized);
    return { createdFiles: [configPath], updatedFiles: [], unchangedFiles: [] };
  }
  const current = await fs.readFile(configPath, "utf8");
  if (current === serialized) {
    return { createdFiles: [], updatedFiles: [], unchangedFiles: [configPath] };
  }
  await writeFileAtomic(configPath, serialized);
  return { createdFiles: [], updatedFiles: [configPath], unchangedFiles: [] };
}

async function ensureRepositoryCodexGitignore(repositoryPath) {
  const gitignorePath = `${repositoryPath}/.gitignore`;
  if (!(await pathExists(gitignorePath))) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [],
    };
  }

  const current = await fs.readFile(gitignorePath, "utf8");
  const lines = current.split(/\r?\n/);
  if (lines.some((line) => line.trim() === ".codex/" || line.trim() === ".codex")) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [gitignorePath],
    };
  }

  const next = appendGitignoreEntry(current, ".codex/");
  await writeFileAtomic(gitignorePath, next);
  return {
    createdFiles: [],
    updatedFiles: [gitignorePath],
    unchangedFiles: [],
  };
}

async function ensureRepositoryCursorGitignore(repositoryPath) {
  const gitignorePath = `${repositoryPath}/.gitignore`;
  if (!(await pathExists(gitignorePath))) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [],
    };
  }

  const current = await fs.readFile(gitignorePath, "utf8");
  const lines = current.split(/\r?\n/);
  if (lines.some((line) => line.trim() === ".cursor/" || line.trim() === ".cursor")) {
    return {
      createdFiles: [],
      updatedFiles: [],
      unchangedFiles: [gitignorePath],
    };
  }

  const next = appendGitignoreEntry(current, ".cursor/");
  await writeFileAtomic(gitignorePath, next);
  return {
    createdFiles: [],
    updatedFiles: [gitignorePath],
    unchangedFiles: [],
  };
}

async function ensureRepositoryClaudeGitignore(repositoryPath) {
  const gitignorePath = `${repositoryPath}/.gitignore`;
  if (!(await pathExists(gitignorePath))) {
    return { createdFiles: [], updatedFiles: [], unchangedFiles: [] };
  }
  const current = await fs.readFile(gitignorePath, "utf8");
  if (current.split(/\r?\n/).some((line) => line.trim() === ".claude/" || line.trim() === ".claude")) {
    return { createdFiles: [], updatedFiles: [], unchangedFiles: [gitignorePath] };
  }
  await writeFileAtomic(gitignorePath, appendGitignoreEntry(current, ".claude/"));
  return { createdFiles: [], updatedFiles: [gitignorePath], unchangedFiles: [] };
}

function appendGitignoreEntry(current, entry) {
  if (current.length === 0) {
    return `${entry}\n`;
  }

  const normalized = current.endsWith("\n") ? current : `${current}\n`;
  return `${normalized}${entry}\n`;
}

function mergeCodexSessionStartHook(config, hookTarget) {
  const hooks = isPlainObject(config.hooks) ? { ...config.hooks } : {};
  const sessionStartEntries = Array.isArray(hooks.SessionStart) ? hooks.SessionStart.map(cloneHookEntry) : [];
  const managedCommand = renderCodexSessionStartHookCommand(hookTarget);
  let foundGroup = false;

  for (let index = 0; index < sessionStartEntries.length; index += 1) {
    const entry = sessionStartEntries[index];
    const innerHooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    const hookIndex = innerHooks.findIndex((hook) => isManagedCodexSessionStartHook(hook));
    if (hookIndex === -1) {
      continue;
    }

    foundGroup = true;
    const nextInnerHooks = [...innerHooks];
    nextInnerHooks[hookIndex] = {
      type: "command",
      command: managedCommand,
      timeout: 30,
    };
    sessionStartEntries[index] = { ...entry, matcher: CODEX_SESSION_START_MATCHER, hooks: nextInnerHooks };
  }

  if (!foundGroup) {
    sessionStartEntries.push({
      matcher: CODEX_SESSION_START_MATCHER,
      hooks: [
        {
          type: "command",
          command: managedCommand,
          timeout: 30,
        },
      ],
    });
  }

  const stopEntries = Array.isArray(hooks.Stop) ? hooks.Stop.map(cloneHookEntry) : [];
  const stopCommand = renderCodexStopHookCommand(hookTarget);
  const existingStopGroup = stopEntries.findIndex((entry) =>
    Array.isArray(entry?.hooks) && entry.hooks.some((hook) => isManagedCodexStopHook(hook)),
  );
  const managedStopHook = {
    type: "command",
    command: stopCommand,
    timeout: 30,
  };
  if (existingStopGroup === -1) {
    stopEntries.push({ hooks: [managedStopHook] });
  } else {
    const entry = stopEntries[existingStopGroup];
    stopEntries[existingStopGroup] = {
      ...entry,
      hooks: entry.hooks.map((hook) => (isManagedCodexStopHook(hook) ? managedStopHook : hook)),
    };
  }
  hooks.SessionStart = sessionStartEntries;
  hooks.Stop = stopEntries;
  return {
    ...config,
    hooks,
  };
}

function hasManagedCodexSessionStartHook(config, hookTarget) {
  const entries = Array.isArray(config?.hooks?.SessionStart) ? config.hooks.SessionStart : [];
  const expectedCommand = renderCodexSessionStartHookCommand(hookTarget);

  return entries.some((entry) =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some(
      (hook) =>
        hook?.type === "command" &&
        hook?.command === expectedCommand,
    ),
  );
}

function hasManagedCodexStopHook(config, hookTarget) {
  const entries = Array.isArray(config?.hooks?.Stop) ? config.hooks.Stop : [];
  const expectedCommand = renderCodexStopHookCommand(hookTarget);
  return entries.some((entry) =>
    Array.isArray(entry?.hooks) &&
    entry.hooks.some((hook) => hook?.type === "command" && hook?.command === expectedCommand),
  );
}

function mergeCursorStopHook(config, hookTarget) {
  const hooks = isPlainObject(config.hooks) ? { ...config.hooks } : {};
  const stopEntries = Array.isArray(hooks[CURSOR_STOP_HOOK_EVENT])
    ? hooks[CURSOR_STOP_HOOK_EVENT].map((entry) => (isPlainObject(entry) ? { ...entry } : entry))
    : [];
  const managedCommand = renderCursorStopHookCommand(hookTarget);
  const hookIndex = stopEntries.findIndex((hook) => isManagedCursorStopHook(hook));
  const managedHook = { command: managedCommand };

  if (hookIndex === -1) {
    stopEntries.push(managedHook);
  } else {
    stopEntries[hookIndex] = managedHook;
  }

  hooks[CURSOR_STOP_HOOK_EVENT] = stopEntries;

  return {
    version: Number.isInteger(config.version) ? config.version : 1,
    ...config,
    hooks,
  };
}

function hasManagedCursorStopHook(config, hookTarget) {
  const stopEntries = Array.isArray(config?.hooks?.[CURSOR_STOP_HOOK_EVENT])
    ? config.hooks[CURSOR_STOP_HOOK_EVENT]
    : [];
  const expectedCommand = renderCursorStopHookCommand(hookTarget);

  return stopEntries.some((hook) => hook?.command === expectedCommand);
}

function mergeClaudeStopHook(config, hookTarget) {
  const hooks = isPlainObject(config.hooks) ? { ...config.hooks } : {};
  const stopEntries = Array.isArray(hooks.Stop) ? hooks.Stop.map(cloneHookEntry) : [];
  const managedCommand = renderClaudeStopHookCommand(hookTarget);
  let found = false;

  for (let index = 0; index < stopEntries.length; index += 1) {
    const entry = stopEntries[index];
    const innerHooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
    const hookIndex = innerHooks.findIndex((hook) => isManagedClaudeStopHook(hook));
    if (hookIndex === -1) continue;
    found = true;
    const nextInnerHooks = [...innerHooks];
    nextInnerHooks[hookIndex] = { type: "command", command: managedCommand, timeout: 30 };
    stopEntries[index] = { ...entry, hooks: nextInnerHooks };
  }
  if (!found) stopEntries.push({ hooks: [{ type: "command", command: managedCommand, timeout: 30 }] });
  hooks.Stop = stopEntries;
  return { ...config, hooks };
}

function hasManagedClaudeStopHook(config, hookTarget) {
  const expectedCommand = renderClaudeStopHookCommand(hookTarget);
  return (Array.isArray(config?.hooks?.Stop) ? config.hooks.Stop : []).some((entry) =>
    Array.isArray(entry?.hooks) && entry.hooks.some((hook) => hook?.type === "command" && hook?.command === expectedCommand),
  );
}

function renderCodexStopHookCommand(hookTarget) {
  if (hookTarget.scope === "repository") {
    return `node .codex/hooks/${OPENAI_STYLE_STOP_HOOK_FILE}`;
  }

  return `node ${JSON.stringify(hookTarget.stopHookPath)}`;
}

function renderCodexSessionStartHookCommand(hookTarget) {
  if (hookTarget.scope === "repository") {
    return "node .codex/hooks/" + CODEX_SESSION_START_HOOK_FILE;
  }

  return "node " + JSON.stringify(hookTarget.sessionStartHookPath);
}

function renderCursorStopHookCommand(hookTarget) {
  if (hookTarget.scope === "repository") {
    return `node .cursor/hooks/${OPENAI_STYLE_STOP_HOOK_FILE}`;
  }

  return `node ${JSON.stringify(hookTarget.stopHookPath)}`;
}

function renderClaudeStopHookCommand(hookTarget) {
  return hookTarget.scope === "repository"
    ? `node .claude/hooks/${OPENAI_STYLE_STOP_HOOK_FILE}`
    : `node ${JSON.stringify(hookTarget.stopHookPath)}`;
}

function isManagedCodexStopHook(hook) {
  return (
    hook?.type === "command" &&
    typeof hook.command === "string" &&
    hook.command.includes(OPENAI_STYLE_STOP_HOOK_FILE)
  );
}

function isManagedCodexSessionStartHook(hook) {
  return (
    hook?.type === "command" &&
    typeof hook.command === "string" &&
    hook.command.includes(CODEX_SESSION_START_HOOK_FILE)
  );
}

function isManagedCursorStopHook(hook) {
  return typeof hook?.command === "string" && hook.command.includes(OPENAI_STYLE_STOP_HOOK_FILE);
}

function isManagedClaudeStopHook(hook) {
  return hook?.type === "command" && typeof hook.command === "string" && hook.command.includes(OPENAI_STYLE_STOP_HOOK_FILE);
}

function cloneHookEntry(entry) {
  if (!isPlainObject(entry)) {
    return entry;
  }

  return {
    ...entry,
    hooks: Array.isArray(entry.hooks) ? entry.hooks.map((hook) => (isPlainObject(hook) ? { ...hook } : hook)) : entry.hooks,
  };
}

async function readJsonIfExists(targetPath, hostName = "host") {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  try {
    return JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch (error) {
    throw new SLAError(`The ${hostName} hooks config is invalid and could not be read.`, {
      code: `INVALID_${hostName.toUpperCase()}_HOOKS_CONFIG`,
      exitCode: 1,
      details: {
        configPath: targetPath,
        reason: error.message,
      },
    });
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function resolveCodexHookTarget(options = {}) {
  if (!options.repository) {
    return {
      scope: "global",
      repositoryPath: null,
      hooksPath: getCodexHooksPath(),
      hooksConfigPath: getCodexHooksConfigPath(),
      stopHookPath: getCodexHookScriptPath(OPENAI_STYLE_STOP_HOOK_FILE),
      sessionStartHookPath: getCodexHookScriptPath(CODEX_SESSION_START_HOOK_FILE),
      persistenceReviewAgentPath: getCodexCustomAgentPath(CODEX_PERSISTENCE_REVIEW_AGENT),
    };
  }

  const repositoryPath = await resolveRepositoryPath(options.repository);
  const hooksRoot = resolveCodexHooksRoot(repositoryPath);

  return {
    scope: "repository",
    repositoryPath,
    hooksPath: `${hooksRoot}/hooks`,
    hooksConfigPath: `${hooksRoot}/hooks.json`,
    stopHookPath: `${hooksRoot}/hooks/${OPENAI_STYLE_STOP_HOOK_FILE}`,
    sessionStartHookPath: path.join(hooksRoot, "hooks", CODEX_SESSION_START_HOOK_FILE),
    persistenceReviewAgentPath: path.join(hooksRoot, "agents", `${CODEX_PERSISTENCE_REVIEW_AGENT}.toml`),
  };
}

async function resolveConfiguredCodexHookTarget(hostConfig) {
  if (hostConfig.hookScope === "repository" && hostConfig.repositoryPath) {
    return resolveCodexHookTarget({ repository: hostConfig.repositoryPath });
  }

  return resolveCodexHookTarget();
}

async function resolveCursorHookTarget(options = {}) {
  if (!options.repository) {
    return {
      scope: "global",
      repositoryPath: null,
      hooksPath: getCursorHooksPath(),
      hooksConfigPath: getCursorHooksConfigPath(),
      stopHookPath: getCursorHookScriptPath(OPENAI_STYLE_STOP_HOOK_FILE),
    };
  }

  const repositoryPath = await resolveRepositoryPath(options.repository);
  const hooksRoot = resolveCursorHooksRoot(repositoryPath);

  return {
    scope: "repository",
    repositoryPath,
    hooksPath: `${hooksRoot}/hooks`,
    hooksConfigPath: `${hooksRoot}/hooks.json`,
    stopHookPath: `${hooksRoot}/hooks/${OPENAI_STYLE_STOP_HOOK_FILE}`,
  };
}

async function resolveConfiguredCursorHookTarget(hostConfig) {
  if (hostConfig.hookScope === "repository" && hostConfig.repositoryPath) {
    return resolveCursorHookTarget({ repository: hostConfig.repositoryPath });
  }

  return resolveCursorHookTarget();
}

async function resolveClaudeHookTarget(options = {}) {
  if (!options.repository) {
    return {
      scope: "global", repositoryPath: null, hooksPath: getClaudeHooksPath(),
      hooksConfigPath: getClaudeSettingsPath(), stopHookPath: getClaudeHookScriptPath(OPENAI_STYLE_STOP_HOOK_FILE),
    };
  }
  const repositoryPath = await resolveRepositoryPath(options.repository);
  const hooksRoot = resolveClaudeHooksRoot(repositoryPath);
  return {
    scope: "repository", repositoryPath, hooksPath: `${hooksRoot}/hooks`,
    hooksConfigPath: `${hooksRoot}/settings.json`, stopHookPath: `${hooksRoot}/hooks/${OPENAI_STYLE_STOP_HOOK_FILE}`,
  };
}

async function resolveConfiguredClaudeHookTarget(hostConfig) {
  return hostConfig.hookScope === "repository" && hostConfig.repositoryPath
    ? resolveClaudeHookTarget({ repository: hostConfig.repositoryPath })
    : resolveClaudeHookTarget();
}

async function resolveRepositoryPath(inputPath) {
  const repositoryPath = await fs.realpath(inputPath).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new SLAError("The repository path does not exist.", {
        code: "REPOSITORY_NOT_FOUND",
        exitCode: 1,
        details: {
          repositoryPath: inputPath,
        },
      });
    }

    throw error;
  });

  const stats = await fs.stat(repositoryPath);
  if (!stats.isDirectory()) {
    throw new SLAError("The repository path must be a directory.", {
      code: "REPOSITORY_NOT_DIRECTORY",
      exitCode: 1,
      details: {
        repositoryPath,
      },
    });
  }

  return repositoryPath;
}

function resolveCodexHooksRoot(repositoryPath) {
  if (path.basename(repositoryPath) === ".codex") {
    return repositoryPath;
  }

  return `${repositoryPath}/.codex`;
}

function resolveCursorHooksRoot(repositoryPath) {
  if (path.basename(repositoryPath) === ".cursor") {
    return repositoryPath;
  }

  return `${repositoryPath}/.cursor`;
}

function resolveClaudeHooksRoot(repositoryPath) {
  return path.basename(repositoryPath) === ".claude" ? repositoryPath : `${repositoryPath}/.claude`;
}

function ensureHermesModeRequested() {
  if (!isHermesAgentRequested()) {
    throw new SLAError("Hermes host install requires --hermes-agent. Re-run as 'sla --hermes-agent host install hermes'.", {
      code: "HERMES_AGENT_FLAG_REQUIRED",
      exitCode: 2,
    });
  }
}

function ensureHermesConfig(config) {
  if (config.agentFlavor !== "hermes" || getAgentFlavor() !== "hermes") {
    throw new SLAError("The selected SLA home is not initialized for Hermes. Run 'sla --hermes-agent install' first.", {
      code: "HERMES_NOT_INITIALIZED",
      exitCode: 1,
    });
  }

  return config;
}

async function requireHermesConfig() {
  return ensureHermesConfig(await requireConfig());
}

async function resolveHermesInstallProfile(config, options = {}) {
  const profile = options.hermesProfile || config.defaultProfile;
  await assertProfileExists(profile);
  return profile;
}

async function ensureManagedSkillSubdirectories(skillPath) {
  for (const subdir of ["references", "templates", "scripts", "assets"]) {
    await ensureDirectory(path.join(skillPath, subdir));
  }
}

async function writeTrackedFile(targetPath, content, buckets) {
  if (!(await pathExists(targetPath))) {
    await writeFileAtomic(targetPath, content);
    buckets.createdFiles.push(targetPath);
    return;
  }

  const current = await fs.readFile(targetPath, "utf8");
  if (current === content) {
    buckets.unchangedFiles.push(targetPath);
    return;
  }

  await writeFileAtomic(targetPath, content);
  buckets.updatedFiles.push(targetPath);
}

module.exports = {
  hostInstallRequiresOverwrite,
  installHost,
  listHosts,
  uninstallHostHooks,
};
