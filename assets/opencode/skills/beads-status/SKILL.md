---
name: beads-status
description: Summarize Beads progress, ready work, blocked work, and the next best task without modifying project state.
---

# beads-status

Use this skill when the user wants a concise operational view of the current Beads backlog.

## Goal

Turn raw `br` output into a short, actionable status report that answers: what is done, what is ready now, what is blocked, and what should happen next.

## Workflow

1. Treat this as read-only.
   - Never modify beads from this skill.

2. Review the current state.
   - Use `br stats` for totals and progress.
   - Use `br ready --json` for immediately actionable work.
   - Use `br list --json -s in_progress` for active work.
   - Use `br blocked --json` when available to identify blocked items.

3. Add graph context when optional tooling exists.
   - If `bv` is available, you may include extra insight such as likely bottlenecks or high-impact next work.
   - Do not fail if `bv` is missing.

4. Report clearly.
   - Progress: how many tasks are open vs closed.
   - Ready now: the most actionable beads.
   - In progress: anything currently being worked on.
   - Blocked: what is stuck and why.
   - Next best move: the single highest-value next action.

## Rules

- Keep the result concise and operational.
- Prefer a decision-oriented summary over dumping raw command output.
- Never modify beads or project files from this skill.
