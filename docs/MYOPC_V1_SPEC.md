# MYOPC v1 Spec

## Goal

`myopc` installs a complete OpenCode Beads workflow with one command:

1. `npx myopc`
2. Open OpenCode
3. Use `/beads-plan`, `/beads-work`, and `/beads-status`

## Canonical package shape

- Standalone npm CLI
- Native OpenCode assets
- Global install target at `~/.config/opencode`
- Manifest-based ownership through `.myopc-manifest.json`
- Single-agent workflow by default

## Installed assets

- 3 skills:
  - `beads-plan`
  - `beads-work`
  - `beads-status`
- 3 commands:
  - `beads-plan`
  - `beads-work`
  - `beads-status`

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

## Runtime behavior inside OpenCode

- `/beads-plan` uses `subtask: true`
- `/beads-work` uses `subtask: true`
- `/beads-status` stays inline
- `beads-plan` performs plan generation and plan-to-beads conversion in one flow
- `beads-work` claims, implements, verifies, closes, and syncs one bead at a time
- `beads-status` remains read-only and concise

## CLI command surface

### `install`

- Default command when no subcommand is provided
- Creates missing directories
- Copies packaged assets into the target OpenCode config directory
- Updates previously managed files safely
- Writes or refreshes `.myopc-manifest.json`

### `doctor`

- Checks whether `br` is available
- Checks whether `bv` is available
- Reports whether the manifest exists
- Reports one status per asset:
  - `ok`
  - `present`
  - `modified`
  - `conflict`
  - `missing`

### `uninstall`

- Removes files owned by `myopc`
- Restores backups created when unmanaged files were overwritten
- Leaves locally modified managed files in place unless `--force` is set
- Requires `--yes` in non-interactive environments

## CLI options

- `--yes`, `-y`
  - Disables prompts
- `--force`, `-f`
  - Overwrites or removes conflicting files after backup
- `--config-dir <path>`
  - Uses a custom OpenCode config directory instead of `~/.config/opencode`
- `--help`, `-h`
  - Prints usage
- `--version`, `-V`
  - Prints package version

## Conflict policy

- If a target file does not exist, create it.
- If a target file already matches the packaged asset, leave it untouched.
- If a file is already managed by `myopc`, update it safely.
- If a managed file has local edits, overwrite it only with confirmation or `--force`, and keep a `.myopc.local-*` backup.
- If a file exists but is unmanaged, overwrite it only with confirmation or `--force`, and keep a `.myopc.bak-*` backup.
- If an unmanaged conflict is skipped, the asset remains outside manifest ownership.

## Non-goals

- Plugin installation
- Agent Mail integration
- Hidden worker subagent installation by default
- `doc-writer`
- Automatic git commit or push
- Project-local `.opencode` install mode

## Success criteria

1. A clean machine can run `npx myopc --yes`.
2. OpenCode picks up the installed commands immediately.
3. Running install repeatedly is safe.
4. `doctor` reports missing dependencies such as `br`.
5. `uninstall` removes only manifest-owned files and restores eligible backups.
