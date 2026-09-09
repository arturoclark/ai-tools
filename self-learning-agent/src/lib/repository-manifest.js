const fs = require("node:fs/promises");
const path = require("node:path");
const { SLAError } = require("./errors");
const { pathExists, writeFileAtomic } = require("./filesystem");
const { getProfileContext } = require("./profile-context");
const { assertProfileExists } = require("./profiles");
const { validateProfileName } = require("./validation");

const MANIFEST_NAME = ".sla";
const MANIFEST_SCHEMA_VERSION = 1;

async function findRepositoryManifest(inputPath = process.cwd()) {
  let directory = await resolveDirectory(inputPath);

  while (true) {
    const manifestPath = path.join(directory, MANIFEST_NAME);
    if (await pathExists(manifestPath)) {
      return { manifestPath, repositoryPath: directory };
    }

    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

async function loadRepositoryManifest(manifestPath) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    throw invalidManifest(manifestPath, "must contain valid JSON", error);
  }

  if (!isPlainObject(parsed) || parsed.schemaVersion !== MANIFEST_SCHEMA_VERSION || !Array.isArray(parsed.profiles)) {
    throw invalidManifest(manifestPath, "must be an object with schemaVersion 1 and a profiles array");
  }

  if (Object.keys(parsed).some((key) => key !== "schemaVersion" && key !== "profiles")) {
    throw invalidManifest(manifestPath, "may contain only schemaVersion and profiles");
  }

  if (parsed.profiles.length === 0) {
    throw invalidManifest(manifestPath, "must configure at least one profile");
  }

  const seen = new Set();
  for (const profile of parsed.profiles) {
    if (typeof profile !== "string") {
      throw invalidManifest(manifestPath, "profiles must contain only profile-name strings");
    }
    try {
      validateProfileName(profile);
    } catch (error) {
      throw invalidManifest(manifestPath, error.message, error);
    }
    if (seen.has(profile)) {
      throw invalidManifest(manifestPath, `may not configure duplicate profile '${profile}'`);
    }
    seen.add(profile);
  }

  return { schemaVersion: parsed.schemaVersion, profiles: parsed.profiles };
}

async function resolveRepositoryProfiles(inputPath = process.cwd()) {
  const discovered = await findRepositoryManifest(inputPath);
  if (!discovered) {
    return {
      found: false,
      manifestPath: null,
      repositoryPath: null,
      profiles: [],
    };
  }

  const manifest = await loadRepositoryManifest(discovered.manifestPath);
  const profiles = await Promise.all(
    manifest.profiles.map(async (profile) => {
      await assertProfileExists(profile);
      const context = await getProfileContext(profile);
      return {
        profile,
        profilePath: context.profilePath,
        operationalContext: context.operationalContext,
        renderedContext: context.renderedContext,
      };
    }),
  );

  return {
    found: true,
    manifestPath: discovered.manifestPath,
    repositoryPath: discovered.repositoryPath,
    schemaVersion: manifest.schemaVersion,
    profiles,
  };
}

async function createRepositoryManifest(inputPath, profiles, options = {}) {
  const directory = await resolveDirectory(inputPath);
  validateProfiles(profiles);
  await Promise.all(profiles.map((profile) => assertProfileExists(profile)));

  const manifestPath = path.join(directory, MANIFEST_NAME);
  if ((await pathExists(manifestPath)) && !options.overwrite) {
    throw new SLAError("A .sla manifest already exists. Re-run with --yes to overwrite it.", {
      code: "SESSION_MANIFEST_OVERWRITE_REQUIRED",
      exitCode: 1,
      details: { manifestPath },
    });
  }

  await writeFileAtomic(
    manifestPath,
    `${JSON.stringify({ schemaVersion: MANIFEST_SCHEMA_VERSION, profiles }, null, 2)}\n`,
  );
  const gitignore = await appendManifestToGitignore(directory);

  return {
    manifestPath,
    repositoryPath: directory,
    profiles,
    gitignore,
  };
}

async function appendManifestToGitignore(directory) {
  const gitignorePath = path.join(directory, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    return { path: gitignorePath, changed: false, exists: false };
  }

  const content = await fs.readFile(gitignorePath, "utf8");
  if (content.split(/\r?\n/).some(isManifestIgnoreEntry)) {
    return { path: gitignorePath, changed: false, exists: true };
  }

  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const prefix = content.length === 0 || content.endsWith("\n") ? "" : newline;
  await fs.writeFile(gitignorePath, `${content}${prefix}.sla${newline}`, "utf8");
  return { path: gitignorePath, changed: true, exists: true };
}

function validateProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new SLAError("Provide at least one --profile option.", {
      code: "SESSION_PROFILE_REQUIRED",
      exitCode: 2,
    });
  }
  const seen = new Set();
  for (const profile of profiles) {
    validateProfileName(profile);
    if (seen.has(profile)) {
      throw new SLAError(`Profile '${profile}' was provided more than once.`, {
        code: "SESSION_PROFILE_DUPLICATE",
        exitCode: 2,
        details: { profile },
      });
    }
    seen.add(profile);
  }
}

async function resolveDirectory(inputPath) {
  const resolved = path.resolve(inputPath);
  let stats;
  try {
    stats = await fs.stat(resolved);
  } catch (error) {
    throw new SLAError("The session path does not exist.", {
      code: "SESSION_PATH_NOT_FOUND",
      exitCode: 2,
      details: { path: resolved },
    });
  }
  if (!stats.isDirectory()) {
    throw new SLAError("The session path must be a directory.", {
      code: "SESSION_PATH_NOT_DIRECTORY",
      exitCode: 2,
      details: { path: resolved },
    });
  }
  return fs.realpath(resolved);
}

function invalidManifest(manifestPath, reason, cause) {
  return new SLAError(`Repository .sla manifest ${reason}.`, {
    code: "INVALID_SESSION_MANIFEST",
    exitCode: 1,
    details: { manifestPath, reason, cause: cause?.message },
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isManifestIgnoreEntry(line) {
  return /^(?:\/)?\.sla\/?$/.test(line.trim());
}

module.exports = {
  MANIFEST_NAME,
  MANIFEST_SCHEMA_VERSION,
  createRepositoryManifest,
  findRepositoryManifest,
  loadRepositoryManifest,
  resolveRepositoryProfiles,
  validateProfiles,
};
