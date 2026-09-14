# Install the spec skills

This directory contains three portable [Agent Skills](https://agentskills.io/) for discovering requirements, creating an approved Beads issue graph, and implementing a tracked issue:

| Skill | Purpose |
| --- | --- |
| `spec-build` | Discover a requirement and prepare an approved, dependency-ordered issue plan. |
| `spec-beads` | Preview, create, and verify the approved plan in Beads. |
| `spec-implement` | Load a Beads issue and its approved spec before implementing it. |

The skills work together, but they are separate skills. The normal order is `spec-build` → `spec-beads` → `spec-implement`.

## What is required

- **Git** to obtain this repository on the new computer.
- **Beads (`bd`)**. This is required: `spec-beads` reads and writes the issue graph, and `spec-implement` reads the selected issue.
- **Node.js 20+ and npm** only when installing the optional Bead Me Up, Scotty board.

Bead Me Up, Scotty (`scotty`) is a local browser UI for people. It shells out to the same `bd` binary and does not replace Beads or add a second tracker. The `spec` skills do not require the UI to run.

`bv` (Beads Viewer) is also different from Scotty. `spec-beads` uses `bv` only for optional, read-only graph validation when it is installed. Install it if that validation is wanted.

## 1. Obtain the skill source on the new host

Clone this repository with an account that has access to it:

```sh
git clone git@github.com:arturoclark/ai-tools.git ~/src/ai-tools
```

If the host does not have an SSH key registered with GitHub, use your organization-approved HTTPS clone URL instead. The source directory used below is `~/src/ai-tools/spec`.

## 2. Install and verify Beads

Install the Beads CLI once for the operating-system user. Use the official installer, which supports macOS, Linux, and Windows:

```sh
curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash
bd version
```

Alternatively, on a host with Homebrew:

```sh
brew install beads
bd version
```

Open a new terminal if `bd` is not on `PATH` immediately after installation.

### Initialize the tracker in a project

Do this in each project whose work will be tracked. It creates a `.beads/` database and may add agent instructions and hooks, so review the target directory first:

```sh
cd /path/to/project
bd init
```

For a project where you want only the tracker database and will manage agent configuration yourself:

```sh
cd /path/to/project
bd init --skip-agents --skip-hooks
```

Do not run `bd init`, `bd setup`, migration, or sync commands against an existing project without the repository owner's approval. They change tracker or agent configuration.

## 3. Install Bead Me Up, Scotty (optional local UI)

Scotty needs Node.js 20+ and an installed `bd` executable. Keep its clone on disk because the global command links to it:

```sh
mkdir -p ~/tools
git clone https://github.com/brendan-appstart/bead-me-up-scotty.git ~/tools/bead-me-up-scotty
cd ~/tools/bead-me-up-scotty
npm install
npm run build
npm link
scotty --help
```

From a Beads-enabled project, start the board:

```sh
cd /path/to/project
scotty
```

It opens a local browser page. To target a project from elsewhere, set `BEADS_REPO=/path/to/project` before running `scotty`. `BD_BIN=/path/to/bd` can be used when `bd` is not on `PATH`.

### Optional: install Beads Viewer (`bv`)

This enables the extra read-only graph checks mentioned in `spec-beads`:

```sh
brew install beads_viewer
bv --help
```

On platforms without Homebrew, follow the [Beads Viewer release/install instructions](https://github.com/Dicklesworthstone/beads_viewer). The skills remain usable without `bv`; report that viewer validation was skipped.

## 4. Install the spec skills in Codex

Codex discovers repository skills at `.agents/skills/<directory>/SKILL.md`; user-wide skills live under `~/.agents/skills/`. Keep the three source directories together because `spec-build` references the sibling Beads adapter.

For a team-shared installation in one repository:

```sh
cd /path/to/project
mkdir -p .agents/skills
cp -R ~/src/ai-tools/spec/build .agents/skills/
cp -R ~/src/ai-tools/spec/beads .agents/skills/
cp -R ~/src/ai-tools/spec/spec-implement .agents/skills/
```

For a user-wide installation on the host, replace `.agents/skills` with `~/.agents/skills`:

```sh
mkdir -p ~/.agents/skills
cp -R ~/src/ai-tools/spec/build ~/.agents/skills/
cp -R ~/src/ai-tools/spec/beads ~/.agents/skills/
cp -R ~/src/ai-tools/spec/spec-implement ~/.agents/skills/
```

Then install Beads’ Codex-specific guidance in the tracker project:

```sh
cd /path/to/project
bd setup codex
bd setup codex --check
```

Restart Codex if the three skills are not listed. Invoke them as `$spec-build`, `$spec-beads`, and `$spec-implement` (or describe a matching task and allow Codex to select the skill).

Before invoking `spec-implement`, point it at the confirmed tracker database:

```sh
export BEADS_DIR=/path/to/project/.beads
```

## 5. Install the same skills in Claude Code

Claude Code uses the same open `SKILL.md` format. Its project skill location is `.claude/skills/`, while its user-wide location is `~/.claude/skills/`. The skill `name` fields already provide the portable identifiers `spec-build`, `spec-beads`, and `spec-implement`; retain the source directories unchanged so the sibling reference continues to work.

Project installation:

```sh
cd /path/to/project
mkdir -p .claude/skills
cp -R ~/src/ai-tools/spec/build .claude/skills/
cp -R ~/src/ai-tools/spec/beads .claude/skills/
cp -R ~/src/ai-tools/spec/spec-implement .claude/skills/
bd setup claude
bd setup claude --check
```

User-wide installation:

```sh
mkdir -p ~/.claude/skills
cp -R ~/src/ai-tools/spec/build ~/.claude/skills/
cp -R ~/src/ai-tools/spec/beads ~/.claude/skills/
cp -R ~/src/ai-tools/spec/spec-implement ~/.claude/skills/
```

Claude Code normally notices changes to an existing skills directory during a session; restart it when creating the top-level directory or if the skills do not appear. Use `/spec-build`, `/spec-beads`, and `/spec-implement`, or ask Claude for the corresponding task. Set `BEADS_DIR=/path/to/project/.beads` before `spec-implement`, just as with Codex.

The only agent-provider differences are skill discovery and Beads' integration recipe: Codex uses `.agents/skills` and `bd setup codex`; Claude Code uses `.claude/skills` and `bd setup claude`. The tracker, skill contents, workflow, and `scotty` UI are the same.

## Other Agent Skills-compatible providers

Use the provider's documented location for a directory containing `SKILL.md`, then copy all three directories without renaming them. The frontmatter follows the Agent Skills format. If the provider cannot discover skills from a directory, add its equivalent of the following explicit instruction to the project-level agent guidance:

```md
This project uses the `spec-build`, `spec-beads`, and `spec-implement` skills.
Use `bd` read-only only after the human approves discovery and specification. Create or modify issues only after the human approves the prepared issue plan; no separate creation gate is required.
Set `BEADS_DIR` to the confirmed `.beads` directory before reading an implementation issue.
```

Do not claim a provider supports the skills until its documentation confirms it supports local `SKILL.md` skills and provides filesystem access to `bd`.

## Verify the complete setup

From the target project:

```sh
bd version
bd prime
bd list --json
scotty --help
```

If `bv` was installed, also run:

```sh
bv --robot-plan --format json
```

`bd prime` and `bd list --json` confirm that the tracker can be read. `scotty --help` confirms the UI launcher is available; start it separately when a person wants the board.

## Updating

Update the tools independently:

```sh
# Beads: use the same installation channel
brew upgrade beads

# Scotty: keep its checkout, rebuild it, and refresh the global link
cd ~/tools/bead-me-up-scotty
git pull --ff-only
npm install
npm run build
npm link
```

For the skill source, update the `ai-tools` checkout. To refresh an existing installation without nesting a second copy of each skill, synchronize each source directory into its matching destination; review local customizations first:

```sh
cd ~/src/ai-tools
git pull --ff-only
rsync -a spec/build/ /path/to/project/.agents/skills/build/
rsync -a spec/beads/ /path/to/project/.agents/skills/beads/
rsync -a spec/spec-implement/ /path/to/project/.agents/skills/spec-implement/
```

Use the corresponding `.claude/skills/` or `~/.agents/skills/` / `~/.claude/skills/` destination when applicable. These commands intentionally do not delete destination-only files.

## Sources

- [Beads installation and agent setup](https://github.com/gastownhall/beads)
- [Bead Me Up, Scotty installation and configuration](https://github.com/brendan-appstart/bead-me-up-scotty)
- [Beads Viewer](https://github.com/Dicklesworthstone/beads_viewer)
- [Codex skills and customization](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
