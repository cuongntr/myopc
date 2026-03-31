---
name: beads-plan
description: Create a dependency-aware implementation plan, convert it into beads with br, and report what is ready next.
---

# beads-plan

Use this skill when the user wants to turn a feature request, bug fix, or refactor into executable Beads tasks.

## Goal

Take a natural-language request, inspect the repository automatically, generate an actionable task graph, create the beads with `br`, wire dependencies, and return a concise summary.

## Workflow

1. Confirm prerequisites.
   - Check that `br` is available.
   - If the repository is not initialized for Beads yet, run `br init`.

2. Gather context automatically.
   - Read `README.md`, `AGENTS.md`, and the most relevant manifest/config files when they exist.
   - Inspect the project structure and the modules touched by the request.
   - Infer the tech stack and existing conventions from the codebase instead of asking the user to paste context.

3. Turn the request into a concrete plan before creating any beads.
   - Use 5-15 tasks for normal work.
   - Split further only if a task would take more than about 2 hours for one coding agent.
   - Every title must start with a verb.
   - Dependencies must form a DAG with no cycles.
   - Foundation tasks must have no dependencies.
   - Testing is required, either inline with implementation or as a separate task when the work is risky or substantial.
   - Every task description must be detailed enough that another agent could implement it without follow-up questions.
   - State conservative assumptions explicitly when requirements are ambiguous.

4. Choose planning depth.
   - Use a standard plan for most work.
   - Switch to the advanced structure only when the work is large, highly ambiguous, spans multiple layers, or is clearly intended for parallel multi-agent execution.

5. Validate the plan.
   - No circular dependencies.
   - No vague tasks like "finish the rest".
   - No missing test coverage.
   - Root tasks are actionable without more user input.

6. Create beads.
   - Create each task with `br create`.
   - Capture the actual bead ID returned by `br`.
   - Maintain a mapping from internal plan IDs to created bead IDs.

7. Wire dependencies.
   - For every `depends_on` edge, run `br dep add <child-id> <parent-id> --type blocks` using the real bead IDs.

8. Persist and verify.
   - Run `br sync --flush-only`.
   - Run `br ready --json` to show what can be worked on next.
   - If `bv` is available, optionally run `bv --robot-plan` for graph visibility.

9. Report back.
   - Summarize the assumptions you made.
   - List how many beads were created.
   - Show the bead ID mapping.
   - Show the first ready beads.
   - Mention any warnings, conflicts, or unresolved ambiguity.

## Rules

- Prefer repository inspection over asking the user for context.
- Do not leave the user with a YAML plan that still needs manual conversion.
- Do not create duplicate open beads for work that already exists; warn the user if you find overlap.
- If `br` is missing or the workspace cannot be initialized safely, stop and explain exactly what blocked the workflow.
