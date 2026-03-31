---
name: beads-work
description: Select a ready bead, implement it with minimal code changes, verify the work, and close it with br.
---

# beads-work

Use this skill when the user wants to execute one bead from a Beads backlog.

## Goal

Pick one ready bead, implement exactly that scope, verify the result, close the bead, and report what changed and what is unblocked next.

## Workflow

1. Select the bead.
   - If the user provided a bead ID, target that bead.
   - Otherwise inspect `br ready --json` and pick the best ready bead.
   - If `bv` is available, you may use it to improve prioritization, but do not require it.

2. Claim the bead.
   - Use `br update <id> --claim` when possible so the claim is atomic.
   - If claim fails because another agent took it, report that and stop or choose another ready bead.

3. Read the bead details.
   - Use `br show --json <id>` to read the title, description, dependencies, and acceptance criteria.
   - Identify the exact files and modules relevant to the bead before editing.

4. Implement the bead.
   - Make the smallest correct code changes.
   - Follow existing project patterns.
   - Do not expand scope beyond the bead description.
   - Do not create a git commit or push.

5. Verify the bead.
   - Run the most relevant tests or checks for the changed area.
   - Check the implementation against the bead acceptance criteria.
   - If verification fails, try to fix the issue. Stop after two serious implementation attempts instead of looping indefinitely.

6. Close the bead.
   - When the work is complete and verified, run `br close <id> --reason "<concise summary>" --suggest-next --json`.
   - If the work is blocked or incomplete, do not close the bead.

7. Persist and report.
   - Run `br sync --flush-only`.
   - Summarize what changed, what tests ran, and which beads are now newly unblocked.

## Rules

- One bead per invocation.
- Do not commit or push to git as part of this workflow.
- If the bead description is too vague to implement safely, stop and ask the user for clarification.
- If tests remain broken, do not close the bead.
- If no bead is ready, explain whether the backlog is done or blocked.
