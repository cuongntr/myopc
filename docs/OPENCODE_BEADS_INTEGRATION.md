# Beads Agent System — OpenCode Integration Guide

> **Purpose**: Describe the OpenCode integration that `myopc` installs.
> **Target**: OpenCode (opencode.ai) with Beads CLI (`br`) as the execution backend.

---

## 1. Installed Integration Model

`myopc` installs native OpenCode assets directly into `~/.config/opencode`.

The shipped architecture is:

- 3 skills
- 3 commands
- `subtask: true` for the long-running plan and work flows
- Inline execution for status
- Manifest-based file ownership for install, doctor, and uninstall

Installed layout:

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

This package does not depend on pre-existing Amp Code or Claude Code assets.

---

## 2. Why This Maps Cleanly to OpenCode

OpenCode exposes four useful primitives for this workflow:

- **Commands** for user-triggered slash workflows
- **Skills** for the long instruction bodies
- **Subtask sessions** for isolating large outputs without defining extra agents
- **Agents/Subagents** when a workflow truly needs different permissions, models, or parallel workers

The installed package uses the smallest working combination:

- `beads-plan` -> skill + command + `subtask: true`
- `beads-work` -> skill + command + `subtask: true`
- `beads-status` -> skill + command

This keeps the runtime simple and avoids agent sprawl.

---

## 3. Component Mapping

| Component | Skill | Command | `subtask: true` | Dedicated agent |
|---|---|---|---|---|
| `beads-plan` | Yes | Yes | Yes | No |
| `beads-work` | Yes | Yes | Yes | No |
| `beads-status` | Yes | Yes | No | No |

### `beads-plan`

- User-triggered with `$ARGUMENTS`
- Reads repository context automatically
- Generates a dependency-aware plan
- Creates beads with `br create`
- Wires dependencies with `br dep add`
- Returns a concise summary with the created bead IDs

### `beads-work`

- User-triggered with an optional bead ID
- Chooses work from `br ready --json` when no ID is given
- Claims the bead with `br update --claim` when possible
- Implements one bead only
- Verifies the result
- Closes with `br close --suggest-next --json`
- Does not commit or push

### `beads-status`

- User-triggered with no arguments
- Reads `br stats`, `br ready`, in-progress work, and blocked work
- Stays read-only
- Runs inline because the output is short and immediately useful in the main session

---

## 4. Why the Package Does Not Install Dedicated Agents

OpenCode agents are the right tool when a workflow needs one of these properties:

- a different permission set
- a different model
- a reusable hidden worker for parallel tasks
- a distinct persona with its own system prompt

The default Beads workflow does not require any of those. It needs:

- reproducible slash commands
- long reusable instructions
- clean subtask isolation for long-running flows

That is exactly what commands and skills already provide.

The current package therefore installs no dedicated agent definitions.

---

## 5. Current Command Implementations

### `/beads-plan`

```markdown
---
description: Decompose a request into dependency-aware beads and create them with br
subtask: true
---

Load the `beads-plan` skill and execute it for this request:

$ARGUMENTS
```

Context injected by the command:

- `br stats`
- the first section of `README.md` when present
- the first section of `AGENTS.md` when present

### `/beads-work`

```markdown
---
description: Pick or target a bead, implement it, verify it, and close it
subtask: true
---
```

Context injected by the command:

- the current ready set from `br ready --json`

### `/beads-status`

```markdown
---
description: Show beads progress, active work, blocked work, and the next best action
---
```

Context injected by the command:

- `br stats`
- `br ready --json`
- `br list --json -s in_progress`
- `br blocked --json`

---

## 6. Installer and Maintenance Commands

### Install

```bash
npx myopc
npx myopc install
npx myopc --yes
```

### Custom target directory

```bash
npx myopc --config-dir /tmp/opencode-test --yes
```

### Conflict overwrite

```bash
npx myopc --force --yes
```

### Health check

```bash
npx myopc doctor
```

### Uninstall

```bash
npx myopc uninstall --yes
```

---

## 7. Ownership and Conflict Semantics

- Matching files remain untouched.
- Managed files are updated in place.
- Unmanaged conflicting files are skipped unless the run is interactive and confirmed or `--force` is present.
- Overwritten unmanaged files receive `.myopc.bak-*` backups.
- Overwritten managed files with local edits receive `.myopc.local-*` backups.
- `.myopc-manifest.json` tracks package-owned files.

`doctor` inspects asset state and reports one of these statuses per file:

- `ok`
- `present`
- `modified`
- `conflict`
- `missing`

---

## 8. Extension Points Outside the Default Install

The package leaves these as optional future work rather than default installation behavior:

- hidden worker subagent for parallel bead execution
- Agent Mail integration for file reservations and coordination
- plugin-based automation or custom tools
- project-local `.opencode` install mode

These remain compatible with the command-and-skill architecture because the current runtime is already isolated around the three core workflows.
