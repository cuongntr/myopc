# myopc

`myopc` is a standalone npm CLI that installs a Beads-oriented OpenCode workflow with one command.

The package writes native OpenCode assets into `~/.config/opencode`, manages them through a local manifest, and exposes a focused daily workflow inside OpenCode:

- `/beads-plan <request>`
- `/beads-work [bead-id]`
- `/beads-status`

## Requirements

- OpenCode installed on the machine
- `br` on `PATH` for planning and execution workflows
- `bv` on `PATH` when graph-oriented status and prioritization are useful

`br` is required. `bv` is optional.

## What it installs

- 3 OpenCode skills:
  - `beads-plan`
  - `beads-work`
  - `beads-status`
- 3 OpenCode commands with the same names
- `.myopc-manifest.json` for install ownership, health checks, and uninstall safety

Default target directory:

```text
~/.config/opencode
```

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

## CLI

Default install:

```bash
npx myopc
```

Explicit install:

```bash
npx myopc install
```

Non-interactive install:

```bash
npx myopc --yes
```

Install into a custom OpenCode config directory:

```bash
npx myopc --config-dir /tmp/opencode-test --yes
```

Overwrite conflicting files after backup:

```bash
npx myopc --force --yes
```

Health check:

```bash
npx myopc doctor
```

Uninstall managed files:

```bash
npx myopc uninstall --yes
```

Help and version:

```bash
npx myopc --help
npx myopc --version
```

## Commands and options

### Commands

- `install`
  - Installs the packaged skills and commands into the OpenCode config directory.
  - This is the default command when no subcommand is provided.
- `doctor`
  - Checks `br`, checks `bv`, inspects the manifest, and reports the status of each managed asset.
- `uninstall`
  - Removes files owned by `myopc` and restores any backups created when unmanaged files were overwritten.

### Options

- `--yes`, `-y`
  - Runs without interactive prompts.
  - Required for `uninstall` in non-interactive environments.
- `--force`, `-f`
  - Overwrites conflicting files after creating backups.
  - Removes modified managed files during uninstall instead of skipping them.
- `--config-dir <path>`
  - Installs into or inspects a custom OpenCode config directory.
- `--help`, `-h`
  - Prints CLI usage.
- `--version`, `-V`
  - Prints the package version.

## OpenCode workflow

### `/beads-plan <request>`

- Loads the `beads-plan` skill
- Runs in `subtask: true` mode
- Reads repository context automatically
- Generates a dependency-aware plan
- Creates beads with `br create`
- Wires dependencies with `br dep add`
- Syncs with `br sync --flush-only`
- Reports the created bead IDs and the next ready work

### `/beads-work [bead-id]`

- Loads the `beads-work` skill
- Runs in `subtask: true` mode
- Targets a specific bead or auto-selects from `br ready`
- Claims the bead with `br update --claim` when possible
- Implements the requested scope
- Runs relevant verification
- Closes the bead with `br close --suggest-next --json` when the work is complete
- Syncs with `br sync --flush-only`

### `/beads-status`

- Loads the `beads-status` skill
- Runs inline in the main OpenCode session
- Summarizes `br stats`, `br ready`, in-progress work, and blocked work
- Uses `bv` only when it is available

## Install and ownership behavior

- Missing target files are created.
- Matching files are left untouched.
- Previously managed files are updated in place.
- Locally modified managed files are overwritten only with confirmation or `--force`.
- Unmanaged conflicting files are overwritten only with confirmation or `--force`.
- Overwritten unmanaged files receive timestamped `.myopc.bak-*` backups.
- Overwritten managed files with local edits receive timestamped `.myopc.local-*` backups.
- `.myopc-manifest.json` tracks the files currently owned by `myopc`.

## Scope

- Native OpenCode install only
- Single-agent workflow by default
- No plugin
- No Agent Mail integration
- No hidden worker subagent by default
- No automatic git commit or push

## Local development

Run the CLI directly from the repo:

```bash
node ./src/cli.js --help
node ./src/cli.js install --config-dir /tmp/opencode-test --yes
node ./src/cli.js doctor --config-dir /tmp/opencode-test
node ./src/cli.js uninstall --config-dir /tmp/opencode-test --yes
```

Package checks:

```bash
npm run lint
npm pack --dry-run
```

See `docs/MYOPC_V1_SPEC.md` for the package contract and `docs/OPENCODE_BEADS_INTEGRATION.md` for the OpenCode-specific architecture.
