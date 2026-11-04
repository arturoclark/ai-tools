# Install the planning skills

This repository provides three independent skills:

| Skill | Source | Use |
| --- | --- | --- |
| `plan-discovery` | `./plan-discovery/` | Research a feature, propose behavioral acceptance criteria, optionally prototype, and assess readiness for a plan. Replaces `discovery`. |
| `plan` | `./` | Write an implementation plan. Discovery is optional. |
| `plan-implement` | `./plan-implement/` | Implement the next unfinished part of an existing plan. |

## Install

Find the directory where your agent provider loads reusable skills or instructions. Copy each skill into its own folder there, so the result has this layout:

```text
<skills-directory>/
├── plan-discovery/
│   ├── SKILL.md
│   ├── assets/
│   │   └── discovery-template.md
│   └── agents/
│       └── openai.yaml
├── plan/
│   └── SKILL.md
└── plan-implement/
    └── SKILL.md
```

From this repository's root, a copy-based install is:

```sh
SKILLS_DIR=/path/to/your/provider/skills
mkdir -p "$SKILLS_DIR/plan" "$SKILLS_DIR/plan-discovery" "$SKILLS_DIR/plan-implement"
cp plan/SKILL.md "$SKILLS_DIR/plan/SKILL.md"
cp -R plan/plan-discovery/. "$SKILLS_DIR/plan-discovery/"
cp plan/plan-implement/SKILL.md "$SKILLS_DIR/plan-implement/SKILL.md"
```

Replace the example destination with the location your provider actually uses. If it does not load `SKILL.md` folders, register each file through its equivalent reusable-instruction mechanism. Provider-specific discovery, naming, and invocation rules vary; follow that provider's documentation. The `agents/` metadata files are optional and are not needed for the skill instructions.

Before using `plan`, set the general or repository-specific plan directory in its `SKILL.md`, or provide a plan location with the request. `plan-discovery` asks where to store each new discovery unless a location is already supplied; an existing discovery file resumes in place. New discoveries use `<location>/<yy-mm-dd>-<feature-slug>/discovery.md`.

Install `plan-discovery` beside `plan` when using discovery as a planning input. In this repository, its source is nested inside `plan/`; the planning skill documents both source and installed locations. You can install any of the three independently. When upgrading, remove the old installed `discovery` skill from your provider's skill directory to avoid competing discovery instructions.
