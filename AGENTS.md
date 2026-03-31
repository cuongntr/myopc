# AGENTS.md

## Purpose
This repository contains `myopc`, a standalone Node.js CLI that installs native OpenCode skills and commands for a Beads-based workflow.
Agents should optimize for small, safe changes to the CLI, packaged OpenCode assets, and the docs.

## Project Shape
- Runtime: plain Node.js ESM, no transpilation step
- Entry point: `src/cli.js`
- Main implementation: `src/myopc.js`
- Packaged assets: `assets/opencode/`
- Documentation: `README.md` and `docs/`
- Package target: `npx myopc`

## Environment
- Node.js: `>=20`
- Package manager: npm
- Module system: ESM (`"type": "module"`)
- Runtime dependencies: none

## Source Layout
- `src/cli.js`: executable wrapper, top-level error handling, exit behavior
- `src/myopc.js`: arg parsing, install/doctor/uninstall flows, manifest handling, overwrite/backup logic
- `assets/opencode/commands/*.md`: shipped OpenCode slash commands; YAML frontmatter must stay valid
- `assets/opencode/skills/**/SKILL.md`: shipped OpenCode skills; YAML frontmatter must stay valid
## Build, Lint, Test, and Verification
## Install dependencies
There are no npm dependencies today, so a fresh clone usually does not require `npm install`.
## Build
There is no compile or bundle step.
Use these package-readiness checks instead:
- `npm pack --dry-run`
- `node ./src/cli.js --help`
## Lint
- `npm run lint`
Runs `node --check` against the shipped JS files.
## Single-file syntax check
- `node --check ./src/cli.js`
- `node --check ./src/myopc.js`
## Tests
There is no automated test runner configured yet.
Current verification is smoke-test based.
Do not claim that `npm test` exists unless you add it to `package.json`.
## Single test
There is no single-test command because there is no test framework configured.
For one targeted validation, use one of these smoke checks:
- `node ./src/cli.js doctor --config-dir /tmp/myopc-test`
- `node ./src/cli.js install --config-dir /tmp/myopc-test --yes`
- `node ./src/cli.js uninstall --config-dir /tmp/myopc-test --yes`
## Recommended verification flows
### For CLI logic changes
- `npm run lint`
- `node ./src/cli.js --help`
- `node ./src/cli.js install --config-dir /tmp/myopc-test --yes`
- `node ./src/cli.js doctor --config-dir /tmp/myopc-test`
- `node ./src/cli.js uninstall --config-dir /tmp/myopc-test --yes`
### For packaging changes
- `npm run lint`
- `npm pack --dry-run`
### For asset-only markdown changes
- `npm run lint`
- `node ./src/cli.js install --config-dir /tmp/myopc-test --yes`
- `node ./src/cli.js doctor --config-dir /tmp/myopc-test`
## Publish-Relevant Checks
- `package.json` `files` still includes everything needed
- `bin.myopc` still points to `./src/cli.js`
- `README.md` matches the actual CLI surface
- Packaged command and skill filenames still match install expectations
## Code Style
## General style
- Use modern ESM imports
- Use semicolons
- Use double quotes
- Use 2-space indentation
- Keep functions small and single-purpose
- Prefer straightforward control flow over abstraction
- Match the existing low-dependency, stdlib-only style
## Imports
- Group Node built-ins at the top
- Use explicit `node:` specifiers for built-ins
- Put local imports after built-ins
- Keep import ordering stable and readable
- Do not introduce third-party dependencies for simple stdlib tasks
Example:
```js
import process from "node:process";
import { run } from "./myopc.js";
```
## Formatting conventions
- Prefer trailing commas in multiline arrays and objects
- Use one property per line in multiline objects
- Break long function calls across lines instead of compressing them
- Keep markdown wrapped for readability, but do not reflow command blocks unnecessarily
## Types and data modeling
- This project is JavaScript, not TypeScript
- Make data shapes obvious through naming and small helper functions
- Use plain objects for structured return values
- Keep manifest entry shapes consistent across read, write, and update paths
- If TypeScript is ever added, do it intentionally rather than gradually mixing TS idioms into JS
## Naming
- Use `camelCase` for variables and functions
- Use `UPPER_SNAKE_CASE` for module-level constants
- Use descriptive names over abbreviations
- Keep command names and asset paths aligned with runtime names
- Keep filenames lowercase and stable
Examples already in the codebase:
- `MANIFEST_FILENAME`
- `parseArgs`
- `runInstall`
- `createManifestEntry`
## Error handling
- Throw `Error` with direct, actionable messages
- Catch errors only when translating them into clearer behavior
- Do not silently swallow unexpected failures
- Returning `null` for missing files is acceptable only in explicit existence helpers like `readFileIfExists`
- Preserve non-`ENOENT` errors
- For CLI subcommands, prefer returning `{ ok: boolean }` and setting `process.exitCode` in the caller
- Keep the hard `process.exit(1)` behavior isolated to the top-level executable wrapper
## File and path handling
- Use `path.resolve()` for user-supplied filesystem paths
- Use `fileURLToPath(new URL(..., import.meta.url))` for packaged asset resolution
- Use `fs.promises` APIs
- Ensure parent directories exist before writing files
- Preserve idempotency in install flows
- Preserve backup semantics when overwriting files
## CLI behavior
- Keep argument parsing explicit and easy to read
- Prefer clear long-option support before adding aliases beyond the existing set
- New commands must be reflected in `parseArgs()`, `renderHelp()`, `README.md`, and `docs/MYOPC_V1_SPEC.md`
- Avoid hidden behavior that changes files without an obvious user-facing command path
## Asset editing rules
- Command markdown files must keep valid YAML frontmatter
- Skill markdown files must keep valid YAML frontmatter
- Do not rename packaged assets casually; install logic relies on stable relative paths
- If an asset path changes, update `ASSETS` in `src/myopc.js` and all relevant docs
- Keep command descriptions concise because they show up in OpenCode
## Documentation rules
- Treat docs as product docs for the current state, not change logs
- Describe current behavior directly
- Keep command examples copy-pasteable
- When CLI options change, update `README.md`, `docs/MYOPC_V1_SPEC.md`, and affected architecture docs in the same change
## Rules Files
No Cursor rules were found in `.cursor/rules/` or `.cursorrules`.
No Copilot instructions were found at `.github/copilot-instructions.md`.
If those files are added later, fold their repository-specific guidance into this document and keep all sources consistent.
## Agent Priorities
- Preserve package correctness over cleverness
- Keep install, doctor, and uninstall behavior safe and predictable
- Avoid introducing dependencies unless there is a strong maintenance reason
- Prefer smoke-testable changes
- Update docs whenever command surface area or package behavior changes
