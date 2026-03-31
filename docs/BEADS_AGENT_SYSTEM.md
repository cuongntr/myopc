# Beads Agent System — myopc Workflow

> **Goal**: Package the full Beads plan → execute → inspect loop for OpenCode through a single installer.
> **Surface area**: one npm CLI, three OpenCode commands, three OpenCode skills.

---

## Daily Workflow

```text
npx myopc
open OpenCode

/beads-plan   "Build auth system"   -> create a dependency-aware bead backlog
/beads-work                        -> implement one ready bead
/beads-status                      -> inspect progress and the next best action
```

That is the complete default loop.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                         Installer                           │
│                                                             │
│  npx myopc                                                  │
│    -> writes native OpenCode commands + skills              │
│    -> records ownership in .myopc-manifest.json             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Runtime                         │
│                                                             │
│  /beads-plan   -> load skill -> inspect repo -> br create   │
│  /beads-work   -> load skill -> claim -> implement -> close │
│  /beads-status -> load skill -> summarize backlog           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     External Tools                          │
│                                                             │
│  br  -> required, task CRUD + dependency graph              │
│  bv  -> optional, graph-oriented insights                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Installer Commands

### Install

```bash
npx myopc
npx myopc install
npx myopc --yes
npx myopc --config-dir /tmp/opencode-test --yes
```

Behavior:

- Creates missing OpenCode config directories.
- Copies packaged assets into the target config directory.
- Writes `.myopc-manifest.json` to track ownership.
- Leaves matching files untouched.
- Overwrites conflicting files only with confirmation or `--force`.

### Doctor

```bash
npx myopc doctor
```

Behavior:

- Checks `br`.
- Checks `bv`.
- Reads the manifest.
- Reports one status for each expected asset.

### Uninstall

```bash
npx myopc uninstall --yes
```

Behavior:

- Removes files owned by `myopc`.
- Restores backups that were created when unmanaged files were overwritten.
- Skips locally modified managed files unless `--force` is set.

---

## Command 1: `/beads-plan`

### What It Does

Turns a feature request, bug fix, or refactor into an actionable bead graph and creates the beads in one flow.

### Runtime Shape

- Installed as `~/.config/opencode/commands/beads-plan.md`
- Backed by `~/.config/opencode/skills/beads-plan/SKILL.md`
- Runs with `subtask: true`

### Workflow

1. Confirm `br` is available.
2. Initialize `.beads/` with `br init` when needed.
3. Read repository context automatically.
4. Generate a dependency-aware plan.
5. Create each bead with `br create`.
6. Map internal plan IDs to returned bead IDs.
7. Wire dependencies with `br dep add`.
8. Sync with `br sync --flush-only`.
9. Report created IDs and ready work.

### Rules

- Prefer repository inspection over asking the user to paste context.
- Keep tasks actionable enough that another agent can implement them without follow-up.
- Convert the plan immediately instead of leaving the user with a manual conversion step.

---

## Command 2: `/beads-work`

### What It Does

Claims one bead, implements its scope, verifies the result, closes the bead, and reports what is unblocked next.

### Runtime Shape

- Installed as `~/.config/opencode/commands/beads-work.md`
- Backed by `~/.config/opencode/skills/beads-work/SKILL.md`
- Runs with `subtask: true`

### Workflow

1. Pick a user-specified bead or choose from `br ready --json`.
2. Claim it with `br update --claim` when possible.
3. Read the bead details with `br show --json`.
4. Implement the requested scope with minimal code changes.
5. Run relevant verification.
6. Close with `br close --suggest-next --json` when complete.
7. Sync with `br sync --flush-only`.

### Rules

- One bead per invocation.
- No automatic git commit or push.
- Do not close the bead if tests remain broken.
- Stop and ask for clarification when the bead description is too vague.

---

## Command 3: `/beads-status`

### What It Does

Summarizes the current bead backlog with a short operational report.

### Runtime Shape

- Installed as `~/.config/opencode/commands/beads-status.md`
- Backed by `~/.config/opencode/skills/beads-status/SKILL.md`
- Runs inline in the main OpenCode session

### Workflow

1. Read `br stats`.
2. Read `br ready --json`.
3. Read `br list --json -s in_progress`.
4. Read `br blocked --json`.
5. Add optional `bv` insight when available.
6. Report progress, active work, blocked work, and the next best action.

---

## Package Boundaries

- Native OpenCode install only
- Single-agent default workflow
- No plugin installation
- No Agent Mail integration
- No hidden worker subagent by default
- No `doc-writer`

---

## Installed File Structure

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

---

## Relationship to `PLAN_TO_BEADS_PROMPT.md`

`PLAN_TO_BEADS_PROMPT.md` remains the reference prompt library for manual and cross-tool usage.

The installed `beads-plan` skill operationalizes the same planning logic directly inside OpenCode and completes the plan-to-beads conversion automatically.
