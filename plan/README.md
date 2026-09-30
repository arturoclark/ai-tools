# Install the planning skills

This repository provides three independent skills:

| Skill | Source | Use |
| --- | --- | --- |
| `discovery` | `../discovery/` | Explore a topic or clarify requirements; can also prepare input for a plan. |
| `plan` | `./` | Write an implementation plan. Discovery is optional. |
| `plan-implement` | `./plan-implement/` | Implement the next unfinished part of an existing plan. |

## Install

Find the directory where your agent provider loads reusable skills or instructions. Copy each skill into its own folder there, so the result has this layout:

```text
<skills-directory>/
├── discovery/
│   └── SKILL.md
├── plan/
│   └── SKILL.md
└── plan-implement/
    └── SKILL.md
```

From this repository's root, a copy-based install is:

```sh
SKILLS_DIR=/path/to/your/provider/skills
mkdir -p "$SKILLS_DIR/plan" "$SKILLS_DIR/discovery" "$SKILLS_DIR/plan-implement"
cp plan/SKILL.md "$SKILLS_DIR/plan/SKILL.md"
cp discovery/SKILL.md "$SKILLS_DIR/discovery/SKILL.md"
cp plan/plan-implement/SKILL.md "$SKILLS_DIR/plan-implement/SKILL.md"
```

Replace the example destination with the location your provider actually uses. If it does not load `SKILL.md` folders, register each file through its equivalent reusable-instruction mechanism. Provider-specific discovery, naming, and invocation rules vary; follow that provider's documentation. The `agents/` metadata files are optional and are not needed for the skill instructions.

Before using `plan`, set the general or repository-specific plan directory in its `SKILL.md`, or provide a plan location with the request. Keep `discovery` and `plan` together when using discovery as a planning input, since they refer to each other's `SKILL.md` files by relative path. You can install any of the three on its own for its standalone purpose.
