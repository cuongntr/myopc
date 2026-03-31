[![Release](https://github.com/cuongntr/myopc/actions/workflows/release.yml/badge.svg)](https://github.com/cuongntr/myopc/actions/workflows/release.yml)

# myopc

`myopc` is a standalone npm CLI that installs a Beads-oriented OpenCode workflow with one command.

It writes native OpenCode assets into `~/.config/opencode` and gives you three core commands inside OpenCode:

- `/beads-plan <request>`
- `/beads-work [bead-id]`
- `/beads-status`

## Requirements

- OpenCode installed on the machine
- `br` on `PATH`
- `bv` on `PATH` when graph-oriented status and prioritization are useful

`br` is required. `bv` is optional.

## Quickstart

```bash
npx myopc
```

Then open OpenCode and run:

```text
/beads-status
/beads-plan Add health check endpoint
/beads-work
```

## What gets installed

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

Install is the default command:

```bash
npx myopc
npx myopc install
```

Common variations:

```bash
npx myopc --yes
npx myopc --force --yes
npx myopc --config-dir /tmp/opencode-test --yes
npx myopc doctor
npx myopc uninstall --yes
npx myopc --help
npx myopc --version
```

## Commands

### `install`

Installs the packaged skills and commands into the OpenCode config directory.

### `doctor`

Checks `br`, checks `bv`, inspects the manifest, and reports the status of each expected asset.

### `uninstall`

Removes files owned by `myopc` and restores backups created when unmanaged files were overwritten.

## Options

### `--yes`, `-y`

Runs without prompts. Required for `uninstall` in non-interactive environments.

### `--force`, `-f`

Overwrites conflicting files after backup. During uninstall, removes modified managed files instead of skipping them.

### `--config-dir <path>`

Uses a custom OpenCode config directory instead of `~/.config/opencode`.

### `--help`, `-h`

Prints CLI usage.

### `--version`, `-V`

Prints the package version.

## OpenCode workflow

### `/beads-plan <request>`

Runs in `subtask: true`, reads repository context automatically, creates a dependency-aware plan, converts it into beads with `br`, wires dependencies, syncs, and reports the ready work.

### `/beads-work [bead-id]`

Runs in `subtask: true`, targets a specific bead or auto-selects from `br ready`, claims it when possible, implements the requested scope, verifies the result, closes the bead, and syncs.

### `/beads-status`

Runs inline in the main OpenCode session and summarizes progress, ready work, in-progress work, and blocked work.

## Ownership behavior

- Missing target files are created.
- Matching files are left untouched.
- Previously managed files are updated in place.
- Managed files with local edits are overwritten only with confirmation or `--force`.
- Unmanaged conflicting files are overwritten only with confirmation or `--force`.
- Overwritten unmanaged files receive `.myopc.bak-*` backups.
- Overwritten managed files with local edits receive `.myopc.local-*` backups.
- `.myopc-manifest.json` tracks files owned by `myopc`.

## Scope

- Native OpenCode install only
- Single-agent workflow by default
- No plugin
- No Agent Mail integration
- No hidden worker subagent by default
- No automatic git commit or push

## Local development

```bash
node ./src/cli.js --help
node ./src/cli.js install --config-dir /tmp/opencode-test --yes
node ./src/cli.js doctor --config-dir /tmp/opencode-test
node ./src/cli.js uninstall --config-dir /tmp/opencode-test --yes

npm run lint
npm pack --dry-run
```

## Documentation

- `docs/MYOPC_V1_SPEC.md`: package contract and CLI behavior
- `docs/OPENCODE_BEADS_INTEGRATION.md`: OpenCode architecture and runtime mapping
- `docs/PLAN_TO_BEADS_PROMPT.md`: planning prompt reference behind `beads-plan`
