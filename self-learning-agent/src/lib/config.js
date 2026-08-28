const fs = require("node:fs/promises");
const { SLAError } = require("./errors");
const { CURRENT_SCHEMA_VERSION, DEFAULT_PROFILE_NAME } = require("./constants");
const { getConfigPath, getRequestedAgentFlavor, setConfiguredAgentFlavor } = require("./paths");
const { pathExists, writeFileAtomic } = require("./filesystem");

function createDefaultConfig(overrides = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    agentFlavor: getRequestedAgentFlavor(),
    defaultProfile: DEFAULT_PROFILE_NAME,
    hosts: {},
    ...overrides,
  };
}

async function loadConfig() {
  const configPath = getConfigPath();
  if (!(await pathExists(configPath))) {
    return null;
  }

  let parsed;
  try {
    const raw = await fs.readFile(configPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new SLAError("The SLA config file is invalid and could not be read.", {
      code: "INVALID_CONFIG",
      exitCode: 1,
      details: { configPath, reason: error.message },
    });
  }

  return normalizeConfig(parsed);
}

function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new SLAError("The SLA config file must contain a JSON object.", {
      code: "INVALID_CONFIG",
      exitCode: 1,
    });
  }

  const normalized = {
    ...config,
    agentFlavor: config.agentFlavor === "hermes" ? "hermes" : "sla",
    hosts: isPlainObject(config.hosts) ? config.hosts : {},
  };

  setConfiguredAgentFlavor(normalized.agentFlavor);
  return normalized;
}

async function saveConfig(config) {
  const normalized = normalizeConfig(config);
  await writeFileAtomic(getConfigPath(), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  createDefaultConfig,
  loadConfig,
  saveConfig,
};
