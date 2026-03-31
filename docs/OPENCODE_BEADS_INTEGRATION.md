# Beads Agent System — OpenCode Integration Guide

> **Purpose**: Describe the OpenCode integration that `myopc` installs.
> **Target**: OpenCode with Beads CLI (`br`) as the execution backend.

## Installed model

`myopc` installs native OpenCode assets directly into `~/.config/opencode`:

```text
~/.config/opencode/
├── commands/
│   ├── beads-plan.md
│   ├── beads-work.md
│   └── beads-status.md
├── skills/
│   ├── beads-plan/SKILL.md
│   ├── beads-work/SKILL.md
│   └── beads-status/SKILL.md
└── .myopc-manifest.json
```

The default runtime model is:

- `beads-plan`: skill + command + `subtask: true`
- `beads-work`: skill + command + `subtask: true`
- `beads-status`: skill + command, inline

This package does not depend on Amp Code or Claude Code assets.

## Why this fits OpenCode

OpenCode already provides the primitives this workflow needs:

- commands for user-triggered slash workflows
- skills for long reusable instructions
- subtask sessions for isolating long-running plan and work flows

The package therefore uses the smallest working architecture and installs no dedicated agents by default.

## Runtime mapping

| Component | Skill | Command | Isolation | Dedicated agent |
|---|---|---|---|---|
| `beads-plan` | Yes | Yes | `subtask: true` | No |
| `beads-work` | Yes | Yes | `subtask: true` | No |
| `beads-status` | Yes | Yes | Inline | No |

## Workflow behavior

### `beads-plan`

- Accepts `$ARGUMENTS` from the slash command
- Reads repository context automatically
- Generates a dependency-aware plan
- Creates beads with `br create`
- Wires dependencies with `br dep add`
- Syncs with `br sync --flush-only`
- Reports created bead IDs and ready work

### `beads-work`

- Accepts an optional bead ID
- Chooses from `br ready --json` when no ID is given
- Claims the bead with `br update --claim` when possible
- Implements exactly one bead
- Verifies the result
- Closes with `br close --suggest-next --json`
- Does not commit or push

### `beads-status`

- Reads `br stats`, `br ready`, in-progress work, and blocked work
- Stays read-only
- Runs inline because the output is short and useful in the main session

## Installed command shape

### `/beads-plan`

- Loads the `beads-plan` skill
- Injects `br stats`
- Injects the opening sections of `README.md` and `AGENTS.md` when present

### `/beads-work`

- Loads the `beads-work` skill
- Injects the current ready set from `br ready --json`

### `/beads-status`

- Loads the `beads-status` skill
- Injects `br stats`
- Injects `br ready --json`
- Injects `br list --json -s in_progress`
- Injects `br blocked --json`

## Installer surface

Common commands:

```bash
npx myopc
npx myopc --yes
npx myopc --force --yes
npx myopc --config-dir /tmp/opencode-test --yes
npx myopc doctor
npx myopc uninstall --yes
```

## Ownership semantics

- Matching files remain untouched.
- Managed files are updated in place.
- Unmanaged conflicting files are skipped unless confirmed interactively or `--force` is present.
- Overwritten unmanaged files receive `.myopc.bak-*` backups.
- Overwritten managed files with local edits receive `.myopc.local-*` backups.
- `.myopc-manifest.json` tracks package-owned files.

`doctor` reports one status per expected asset:

- `ok`
- `present`
- `modified`
- `conflict`
- `missing`

## Outside the default install

These remain future extension points rather than default package behavior:

- hidden worker subagent for parallel bead execution
- Agent Mail integration for file reservations and coordination
- plugin-based automation or custom tools
- project-local `.opencode` install mode

The current command-and-skill model leaves room for those extensions without changing the default workflow.
