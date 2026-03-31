---
description: Show beads progress, active work, blocked work, and the next best action
---

Load the `beads-status` skill and summarize the current backlog.

Stats:

!`br stats 2>/dev/null || true`

Ready:

!`br ready --json 2>/dev/null || true`

In progress:

!`br list --json -s in_progress 2>/dev/null || true`

Blocked:

!`br blocked --json 2>/dev/null || true`
