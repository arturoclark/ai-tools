const os = require("os");
const path = require("path");

let runtimeOptions = {
  hermesAgent: false,
};

let configuredAgentFlavor = null;

function setRuntimeOptions(options = {}) {
  runtimeOptions = {
    ...runtimeOptions,
    hermesAgent: Boolean(options.hermesAgent),
  };
}

function setConfiguredAgentFlavor(agentFlavor) {
  configuredAgentFlavor = agentFlavor || null;
}

function getRequestedAgentFlavor() {
  return runtimeOptions.hermesAgent ? "hermes" : "sla";
}

function getAgentFlavor() {
  return configuredAgentFlavor || getRequestedAgentFlavor();
}

function isHermesAgent() {
  return getAgentFlavor() === "hermes";
}

function isHermesAgentRequested() {
  return getRequestedAgentFlavor() === "hermes";
}

function getDefaultHomeForFlavor(agentFlavor) {
  return path.join(os.homedir(), agentFlavor === "hermes" ? ".hermes" : ".sla");
}

function getSlaHome() {
  return process.env.SLA_HOME || getDefaultHomeForFlavor(getRequestedAgentFlavor());
}

function getCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function getCursorHome() {
  return process.env.CURSOR_HOME || path.join(os.homedir(), ".cursor");
}

function getClaudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function getConfigPath() {
  return path.join(getSlaHome(), "config.json");
}

function getProfilesRoot() {
  return isHermesAgent() ? path.join(getSlaHome(), "profiles") : getSlaHome();
}

function getProfilePath(profileName) {
  return path.join(getProfilesRoot(), profileName);
}

function getSoulPath(profileName) {
  return path.join(getProfilePath(profileName), "SOUL.md");
}

function getMemoriesPath(profileName) {
  return path.join(getProfilePath(profileName), "memories");
}

function getMemoryStorePath(profileName, target) {
  return path.join(getMemoriesPath(profileName), target === "user" ? "USER.md" : "MEMORY.md");
}

function getSkillsPath(profileName) {
  return path.join(getProfilePath(profileName), "skills");
}

function normalizeSkillCategory(category) {
  if (!isHermesAgent()) {
    return null;
  }

  const normalized = String(category || "").trim();
  return normalized || "general";
}

function getSkillPath(profileName, skillName, options = {}) {
  const skillsPath = getSkillsPath(profileName);
  if (!isHermesAgent()) {
    return path.join(skillsPath, skillName);
  }

  return path.join(skillsPath, normalizeSkillCategory(options.category), skillName);
}

function getSkillMarkdownPath(profileName, skillName, options = {}) {
  return path.join(getSkillPath(profileName, skillName, options), "SKILL.md");
}

function getUsagePath(profileName) {
  return path.join(getSkillsPath(profileName), ".usage.json");
}

function getSkillKey(skillName, options = {}) {
  if (!isHermesAgent()) {
    return skillName;
  }

  return `${normalizeSkillCategory(options.category)}/${skillName}`;
}

function getCodexSkillsPath() {
  return path.join(getCodexHome(), "skills");
}

function getCodexHooksPath() {
  return path.join(getCodexHome(), "hooks");
}

function getCodexAgentsPath() {
  return path.join(getCodexHome(), "agents");
}

function getCodexHooksConfigPath() {
  return path.join(getCodexHome(), "hooks.json");
}

function getCodexSkillPath(skillName) {
  return path.join(getCodexSkillsPath(), skillName);
}

function getCodexAgentPath(skillName, agentName = "openai") {
  return path.join(getCodexSkillPath(skillName), "agents", `${agentName}.yaml`);
}

function getCodexHookScriptPath(scriptName) {
  return path.join(getCodexHooksPath(), scriptName);
}

function getCodexCustomAgentPath(agentName) {
  return path.join(getCodexAgentsPath(), `${agentName}.toml`);
}

function getCursorSkillsPath() {
  return path.join(getCursorHome(), "skills");
}

function getCursorHooksPath() {
  return path.join(getCursorHome(), "hooks");
}

function getCursorHooksConfigPath() {
  return path.join(getCursorHome(), "hooks.json");
}

function getCursorSkillPath(skillName) {
  return path.join(getCursorSkillsPath(), skillName);
}

function getCursorHookScriptPath(scriptName) {
  return path.join(getCursorHooksPath(), scriptName);
}

function getClaudeSkillsPath() {
  return path.join(getClaudeHome(), "skills");
}

function getClaudeHooksPath() {
  return path.join(getClaudeHome(), "hooks");
}

function getClaudeSettingsPath() {
  return path.join(getClaudeHome(), "settings.json");
}

function getClaudeSkillPath(skillName) {
  return path.join(getClaudeSkillsPath(), skillName);
}

function getClaudeHookScriptPath(scriptName) {
  return path.join(getClaudeHooksPath(), scriptName);
}

module.exports = {
  getAgentFlavor,
  getCodexAgentPath,
  getCodexAgentsPath,
  getCodexCustomAgentPath,
  getCodexHookScriptPath,
  getCodexHome,
  getCodexHooksConfigPath,
  getCodexHooksPath,
  getCodexSkillPath,
  getCodexSkillsPath,
  getClaudeHome,
  getClaudeHookScriptPath,
  getClaudeHooksPath,
  getClaudeSettingsPath,
  getClaudeSkillPath,
  getClaudeSkillsPath,
  getCursorHookScriptPath,
  getCursorHome,
  getCursorHooksConfigPath,
  getCursorHooksPath,
  getCursorSkillPath,
  getCursorSkillsPath,
  getConfigPath,
  getMemoryStorePath,
  getMemoriesPath,
  getProfilePath,
  getProfilesRoot,
  getRequestedAgentFlavor,
  getSkillKey,
  getSkillMarkdownPath,
  getSkillPath,
  getSkillsPath,
  getSlaHome,
  getSoulPath,
  getUsagePath,
  isHermesAgent,
  isHermesAgentRequested,
  normalizeSkillCategory,
  setConfiguredAgentFlavor,
  setRuntimeOptions,
};
