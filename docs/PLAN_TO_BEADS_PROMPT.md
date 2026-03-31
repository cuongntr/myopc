# Plan-to-Beads Prompt

> Generate structured implementation plans that convert directly into [beads](https://github.com/Dicklesworthstone/beads_rust) for AI agent execution.
>
> - **Installed workflow** → `myopc` packages this logic as the `beads-plan` OpenCode skill and command
> - **Quick Start** → paste the prompt, get a plan, convert manually
> - **Advanced** → multi-agent parallel execution, file reservation, full schema
> - **A good plan = beads that agents can execute without asking questions**

---

## 1. Quick Start Prompt

Copy this prompt. Replace `{{...}}` with your actual content. Leave `{{optional context}}` blank if you don't have it — the model will infer and list assumptions.

````markdown
You are creating a dependency-aware implementation plan. The output will be converted into beads (`br` CLI) — atomic tasks with explicit blocking dependencies that AI coding agents execute one at a time.

## Task
{{Describe the feature, bug fix, or refactoring goal. Be specific about what "done" looks like.}}

## Acceptance Criteria
{{Bullet list of verifiable outcomes. If unsure, write "infer from task description".}}

## Context
{{Paste any useful info: tech stack, affected modules, folder structure, relevant code snippets, conventions, or leave blank.}}

## Rules

1. Produce 5–15 tasks. Split further only if a task would take >2 hours.
2. Each task title starts with a verb: "Create", "Implement", "Add", "Fix", "Write", "Update", "Configure".
3. Express ordering via `depends_on`. The graph must be a DAG — no cycles.
4. Foundation work (schema, config, types) has no dependencies. Higher layers depend on foundations.
5. Testing is required. Include it in the implementation task unless test work is substantial — then make it a separate task that depends on the implementation.
6. The `description` field must be detailed enough that a developer (or AI agent) can start coding without asking questions. Include file paths, function signatures, libraries, and patterns to follow when known.
7. If requirements are ambiguous, state assumptions and proceed conservatively.

## Output

Return ONLY this YAML structure, nothing else:

```yaml
assumptions:
  - "assumption 1"
  - "assumption 2"

tasks:
  - id: "PLAN-001"
    title: "Verb + object (max 80 chars)"
    type: task           # task | bug | feature | docs | chore
    description: |
      What to do, why, which files to create/modify, which patterns to follow.
      Include enough detail to implement without questions.
    depends_on: []       # IDs of tasks that MUST complete before this one starts
    files:               # files this task will create or modify
      - src/path/to/file.ts
    done:                # verifiable completion criteria
      - "criterion 1"
      - "criterion 2"
```
````

That's it. Paste, fill 1–2 placeholders, get a plan.

---

## 2. Example

### Input

```
## Task
Add JWT authentication to our Express.js REST API. Currently all endpoints are public.
Users should register, login, and access protected endpoints with Bearer tokens.

## Acceptance Criteria
- POST /auth/register creates a user and returns a JWT
- POST /auth/login validates credentials and returns a JWT  
- Protected endpoints return 401 without valid token
- Passwords are hashed with bcrypt

## Context
Express.js + TypeScript, Prisma ORM with PostgreSQL.
Routes are in src/routes/, middleware in src/middleware/, Prisma schema in prisma/schema.prisma.
Existing pattern: each route file exports a Router, registered in src/app.ts.
Tests use Jest + supertest in __tests__/.
```

### Output

```yaml
assumptions:
  - "JWT secret will be stored in environment variable JWT_SECRET"
  - "Token expiration is 24 hours (configurable later)"
  - "No refresh token mechanism in this iteration"
  - "bcrypt is already in package.json or will be added"

tasks:
  - id: "PLAN-001"
    title: "Add User model to Prisma schema"
    type: task
    description: |
      Add User model to prisma/schema.prisma with fields: id (uuid), email (unique),
      passwordHash, createdAt, updatedAt. Run `npx prisma migrate dev --name add-user-model`.
      Follow existing model patterns in the schema file.
    depends_on: []
    files:
      - prisma/schema.prisma
      - prisma/migrations/
    done:
      - "User model exists in schema.prisma"
      - "Migration runs successfully"
      - "npx prisma generate produces updated client"

  - id: "PLAN-002"
    title: "Create auth utility functions"
    type: task
    description: |
      Create src/utils/auth.ts with: hashPassword(plain) -> hashed string using bcrypt,
      comparePassword(plain, hash) -> boolean, generateToken(userId) -> JWT string using
      jsonwebtoken, verifyToken(token) -> decoded payload. Use process.env.JWT_SECRET.
      Add bcrypt and jsonwebtoken to dependencies if not present.
    depends_on: []
    files:
      - src/utils/auth.ts
      - package.json
    done:
      - "All 4 functions exported and typed"
      - "Unit tests pass for hash/compare/generate/verify"

  - id: "PLAN-003"
    title: "Implement auth routes (register + login)"
    type: task
    description: |
      Create src/routes/auth.ts exporting a Router with POST /register and POST /login.
      Register: validate email+password, hash password, create user via Prisma, return JWT.
      Login: find user by email, compare password, return JWT or 401.
      Follow existing route patterns in src/routes/. Register router in src/app.ts.
    depends_on: ["PLAN-001", "PLAN-002"]
    files:
      - src/routes/auth.ts
      - src/app.ts
    done:
      - "POST /auth/register creates user and returns token"
      - "POST /auth/login returns token for valid credentials"
      - "POST /auth/login returns 401 for invalid credentials"

  - id: "PLAN-004"
    title: "Create JWT authentication middleware"
    type: task
    description: |
      Create src/middleware/auth.ts exporting an Express middleware that: extracts Bearer
      token from Authorization header, verifies it with verifyToken from src/utils/auth.ts,
      attaches decoded user to req.user, returns 401 if missing/invalid.
      Follow existing middleware patterns in src/middleware/.
    depends_on: ["PLAN-002"]
    files:
      - src/middleware/auth.ts
    done:
      - "Middleware correctly validates JWT and attaches user to request"
      - "Returns 401 with message for missing or invalid tokens"

  - id: "PLAN-005"
    title: "Apply auth middleware to protected routes"
    type: task
    description: |
      Import auth middleware from src/middleware/auth.ts and apply it to all existing
      routes that should be protected. Add middleware before route handlers in src/app.ts
      or individual route files, depending on existing pattern.
    depends_on: ["PLAN-003", "PLAN-004"]
    files:
      - src/app.ts
      - src/routes/
    done:
      - "Existing endpoints return 401 without valid token"
      - "Existing endpoints work normally with valid token"

  - id: "PLAN-006"
    title: "Write integration tests for auth flow"
    type: task
    description: |
      Create __tests__/auth.test.ts with supertest. Test full flow: register user,
      login, access protected endpoint with token, access without token (expect 401),
      register duplicate email (expect 409 or 400). Follow existing test patterns in __tests__/.
    depends_on: ["PLAN-005"]
    files:
      - __tests__/auth.test.ts
    done:
      - "All auth integration tests pass"
      - "Coverage includes register, login, protected access, and error cases"
```

---

## 3. Converting Plan to Beads

When you use the packaged `/beads-plan` workflow from `myopc`, plan generation and conversion happen in one pass. This section remains the reference flow for manual prompt usage and cross-tool workflows.

After the AI generates your plan, convert it to beads. The key challenge: **plan uses sequential IDs (`PLAN-001`), but `br create` generates hash-based IDs (`bd-e9b1d4`)**. You need to map between them.

### Manual Conversion (Small Plans)

```bash
# Step 1: Create all beads, note the returned IDs
br create "Add User model to Prisma schema" --type task --description "..."
# → Created: bd-a1b2c3

br create "Create auth utility functions" --type task --description "..."
# → Created: bd-d4e5f6

br create "Implement auth routes (register + login)" --type task --description "..."
# → Created: bd-g7h8i9

# Step 2: Wire dependencies using ACTUAL bead IDs
# PLAN-003 depends on PLAN-001 and PLAN-002:
br dep add bd-g7h8i9 bd-a1b2c3 --type blocks
br dep add bd-g7h8i9 bd-d4e5f6 --type blocks

# Step 3: Sync
br sync --flush-only
```

### Agent-Assisted Conversion (Recommended)

Give your AI agent this instruction after generating the plan:

```
Read the plan above. For each task, run `br create` with the title, type, and description.
Capture the returned bead ID. After creating all beads, wire dependencies using `br dep add`
with the actual bead IDs. Finally run `br sync --flush-only`.
```

This is the most practical approach — the agent handles the ID mapping automatically.

### Verify

```bash
# See what's ready to work on
br ready --json

# Visualize dependency graph (if bv is installed)
bv --robot-plan
```

---

## 4. When to Use the Advanced Prompt

Use the Quick Start prompt (Section 1) for **most work**. Switch to the Advanced prompt only when:

| Trigger | Why Advanced Helps |
|---|---|
| Plan will have **>15 tasks** | Need sub-epics, parallel tracks |
| **Multiple AI agents** will execute in parallel | Need `files_affected` for file reservation via Agent Mail |
| Feature spans **3+ layers** (DB + API + UI + infra) | Need architecture sketch before decomposition |
| Requirements are **vague or ambiguous** | Need explicit clarification phase |
| Stakeholders need to **review the plan** | Need Mermaid diagram + summary statistics |
| **Bug fix** in production | Need root cause analysis phase first |
| **Refactoring** existing code | Need golden tests before any changes |

---

## 5. Advanced Prompt

Use when the triggers above apply. This adds: architecture sketch, explicit test tasks, file reservation info, parallel track labels, priority levels, and execution summary.

````markdown
You are a senior software architect creating a dependency-aware implementation plan. The output will be converted into beads (`br` CLI) for parallel execution by multiple AI coding agents.

## Task
{{Describe the feature, bug fix, or refactoring goal in detail.}}

## Acceptance Criteria
{{Bullet list of verifiable outcomes.}}

## Context
{{Tech stack, architecture, affected modules, conventions, relevant code snippets.}}

## Constraints
{{What is NOT in scope. Performance/security/compatibility requirements.}}

## Instructions

Work through these phases in order:

### Phase 1 — Clarify
- List your assumptions about the requirements.
- Identify ambiguities. State how you'll resolve each one (conservatively).
- Identify risks and edge cases.

### Phase 2 — Architecture
- Which modules/layers are affected?
- What is the data flow?
- Draw a Mermaid dependency diagram showing task relationships.

### Phase 3 — Decompose
Create the task list in YAML. For each task:

```yaml
- id: "PLAN-001"
  title: "Verb + object (max 80 chars)"
  type: task | bug | feature | epic | docs | chore
  priority: 0-4              # 0=critical 1=high 2=medium 3=low 4=backlog
  estimated_minutes: 60       # realistic for an AI agent
  description: |
    What to do, why, technical approach, file paths, patterns to follow.
  depends_on: []              # task IDs this BLOCKS on
  files:                      # all files this task touches (for file reservation)
    - src/path/to/file.ts
  done:                       # verifiable completion criteria
    - "criterion 1"
  labels:                     # domain tags + parallel track
    - "backend"
    - "track-A"
```

Rules:
- Each task: 15–120 minutes. Split if larger.
- Titles start with a verb.
- Dependencies form a DAG — no cycles.
- Foundation tasks (schema, config, types) come first with no dependencies.
- Create separate test tasks only when test work is substantial or the feature is risky. Otherwise include testing in the implementation task.
- Priority 0–1 for tasks that unblock the most downstream work.
- Use `labels` to mark parallel tracks (e.g., "track-A", "track-B") — independent work streams that can run concurrently.
- `files` must list every file touched — this drives Agent Mail file reservations for conflict-free parallel execution.

### Phase 4 — Validate
- Verify no circular dependencies.
- Identify the critical path (longest chain of sequential tasks).
- Confirm all root tasks (no dependencies) are actionable without external input.

### Phase 5 — Summary
Provide:
- Total tasks / estimated time
- Critical path length
- Parallel tracks identified
- First actionable tasks (zero dependencies)
- Highest-impact task (unblocks the most work)
````

---

## 6. Variations

### Bug Fix

Prepend this before `## Instructions` in either prompt:

```markdown
## Bug Context
- Steps to reproduce: {{steps}}
- Expected behavior: {{expected}}
- Actual behavior: {{actual}}
- Error logs: {{paste relevant logs}}

## Additional Rules for Bug Fix
- First task MUST be "Write failing test that reproduces the bug".
- Include a root cause analysis in the first task's description.
- Last task MUST verify no regressions in existing tests.
```

### Refactoring

```markdown
## Refactoring Context
- Current state: {{what the code looks like now}}
- Desired state: {{what it should look like after}}
- Motivation: {{why this refactoring is needed}}

## Additional Rules for Refactoring
- First task MUST be "Create golden tests capturing current behavior".
- Every subsequent task must keep existing tests green.
- No behavior changes — structural changes only.
```

### Epic (>15 tasks)

```markdown
## Additional Rules for Epic
- First, break the work into 2–4 sub-epics (each ≤15 tasks).
- Create one parent epic task, then decompose each sub-epic separately.
- Each sub-epic should be independently deployable if possible.
- Use parent-child dependency type between epic and sub-tasks.
```

---

## 7. Chained Prompting (For Complex/Ambiguous Work)

When to use: requirements are vague, work spans 3+ system layers, or you expect >15 tasks.

**Prompt 1 — Clarify:**
```
Analyze this feature request: {{feature}}. List: (1) your assumptions, (2) ambiguities
you see, (3) risks, (4) edge cases. Don't start planning yet — just analyze.
```

**Prompt 2 — Architect:**
```
Based on your analysis, sketch the architecture: which modules are affected, what's
the data flow, what are the integration points. Draw a Mermaid diagram. No task list yet.
```

**Prompt 3 — Decompose:**
```
Now decompose into tasks using this YAML format: [paste Quick Start output format].
Wire all dependencies. Keep each task under 2 hours.
```

**Prompt 4 — Review:**
```
Review your plan. Check for: circular dependencies, tasks >2 hours, vague descriptions
where a developer couldn't start coding, missing tests, missing error handling.
Fix any issues and output the final YAML.
```

---

## 8. Multi-Agent Execution (with Agent Mail)

When multiple agents execute beads in parallel, use shared identifiers:

| Where | Format | Example |
|---|---|---|
| Bead ID | `bd-<hash>` | `bd-e9b1d4` |
| Agent Mail `thread_id` | = bead ID | `bd-e9b1d4` |
| Message subject | `[bd-<id>] <desc>` | `[bd-e9b1d4] Starting auth routes` |
| File reservation `reason` | = bead ID | `bd-e9b1d4` |
| Git commit | includes bead ID | `feat: auth routes (bd-e9b1d4)` |

### Agent Execution Loop

```
1. br ready --json              → pick highest-priority unblocked task
2. file_reservation_paths(...)  → reserve files (Agent Mail)
3. send_message(thread_id=...) → announce start
4. Implement + test
5. br close <id> --reason "..." → mark complete (may unblock others)
6. release_file_reservations()  → release files
7. br sync --flush-only         → persist to JSONL + git
8. Loop back to 1
```

Use `bv --robot-plan` to see parallel tracks and `bv --robot-priority` to find highest-impact tasks.

---

## 9. Key Principles

1. **A plan is only good if an agent can execute each task without asking questions.** The `description` field is the most important field. If it's vague, the agent will hallucinate or get stuck.

2. **Dependencies replace prose ordering.** Don't write "do A before B". Express it as `depends_on: ["A"]`. The `br ready` command enforces this automatically.

3. **Start small, scale up.** Use the Quick Start prompt for 80% of work. Only reach for the Advanced prompt when complexity demands it.

4. **Testing is required, not optional.** But it doesn't always need its own task. Use judgment: separate test tasks for risky/complex work, inline testing for straightforward changes.

5. **Assumptions are better than silence.** If the model doesn't know something, it should say so explicitly in `assumptions` and proceed conservatively — not hallucinate file paths or API contracts.
