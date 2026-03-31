# OpenCode Agent Architecture — Phân Tích Sâu

> **Mục đích**: Tài liệu phân tích chi tiết về Commands, Agents, Subagents, Skills trong OpenCode.
> Khi nào dùng cái gì, mô hình Orchestrator có hợp lý không, và các anti-patterns cần tránh.
>
> **Phạm vi**: General workflow — không gắn với bất kỳ tool/project cụ thể nào.
> **Áp dụng trong repo này**: `myopc` cài 3 commands và 3 skills native vào `~/.config/opencode`, dùng `subtask: true` cho `beads-plan` và `beads-work`, giữ `beads-status` inline, và không cài dedicated agents mặc định.
> **Nguồn**: OpenCode docs, community practices, distributed systems principles.

---

## Mục lục

1. [Bốn primitives cơ bản](#1-bốn-primitives-cơ-bản)
2. [Decision framework — Dùng cái gì khi nào](#2-decision-framework)
3. [Agent vs Subagent — Phân tích sâu](#3-agent-vs-subagent)
4. [Mô hình Orchestrator → Subagents](#4-mô-hình-orchestrator--subagents)
5. [Các anti-patterns phổ biến](#5-các-anti-patterns-phổ-biến)
6. [Patterns hiệu quả trong thực tế](#6-patterns-hiệu-quả-trong-thực-tế)
7. [Context rot và cách subagent giải quyết](#7-context-rot-và-cách-subagent-giải-quyết)
8. [Thiết kế cho project thực tế](#8-thiết-kế-cho-project-thực-tế)

---

## 1. Bốn Primitives Cơ Bản

### Công thức một dòng

> **Commands** = bạn muốn làm gì (input).
> **Agents** = ai làm việc đó (executor).
> **Skills** = kiến thức agent có thể tra cứu (context).
> **Tools** = hành động agent được phép thực hiện (capabilities).

### 1.1. Command — Prompt shortcut

**Bản chất**: Một prompt template được lưu sẵn. Khi gõ `/test`, OpenCode gửi nội dung file đó cho agent hiện tại. Không có logic đặc biệt — chỉ là text.

**Đặc trưng kỹ thuật**:
- Nhận arguments: `$ARGUMENTS`, `$1`, `$2`...
- Inject shell output: `` !`git diff --staged` `` — chạy lệnh, đưa kết quả vào prompt TRƯỚC khi gửi cho LLM
- Inject file content: `@src/auth.ts` — đọc file, nhét vào prompt
- Chỉ định agent: `agent: plan` — gửi prompt tới agent cụ thể thay vì agent hiện tại
- Chạy isolated: `subtask: true` — force tạo session con riêng biệt
- Chỉ định model: `model: provider/model-id` — override model cho lần chạy này

**Không có**:
- Permissions riêng — kế thừa từ agent chạy nó
- Tool config riêng — kế thừa từ agent
- State persistence — chạy xong là hết
- Multi-turn logic — chỉ inject 1 prompt

```yaml
# ~/.config/opencode/commands/review-pr.md
---
description: Review PR changes against base branch
agent: plan
subtask: true
---
Review all changes from the current branch against main.

Recent commits:
!`git log --oneline main..HEAD`

Changed files:
!`git diff --stat main..HEAD`

Focus on: security, performance, breaking changes.
```

### 1.2. Agent — AI persona

**Bản chất**: Một "nhân cách AI" với model, permissions, tools, system prompt riêng. Tồn tại xuyên suốt session. Mọi thứ chạy trong OpenCode đều chạy qua một agent nào đó.

**Hai loại**:

| | Primary Agent | Subagent |
|---|---|---|
| **Truy cập** | Tab để switch, user tương tác trực tiếp | @mention hoặc Task tool |
| **Session** | Conversation chính | Session con riêng biệt |
| **Khi nào** | Tư duy chính, quyết định | Task cụ thể, delegation |
| **Built-in** | Build, Plan | General, Explore |

**Đặc trưng kỹ thuật**:
- `mode`: primary / subagent / all
- `model`: override model (ví dụ plan dùng reasoning model, build dùng fast model)
- `permission`: fine-grained control trên edit/bash/webfetch/skill/task
- `hidden`: ẩn khỏi @autocomplete — chỉ gọi qua Task tool
- `steps`: giới hạn số agentic iterations — kiểm soát cost
- `temperature`, `top_p`: tuning output style
- `permission.task`: control subagent nào agent này được gọi

```yaml
# ~/.config/opencode/agents/security-review.md
---
description: Reviews code for security vulnerabilities
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash:
    "*": deny
    "grep *": allow
    "git log*": allow
    "git diff*": allow
---
You are a security auditor. Analyze code for vulnerabilities.
Never modify files. Only report findings with severity levels.
```

### 1.3. Skill — On-demand knowledge

**Bản chất**: Tài liệu hướng dẫn mà agent load khi cần qua `skill` tool. Agent thấy danh sách skills (name + description) và tự quyết khi nào load full content.

**Khác biệt quan trọng so với command**:
- Command: USER trigger → agent nhận prompt
- Skill: AGENT tự quyết → load knowledge khi thấy relevant

**Đặc trưng kỹ thuật**:
- Frontmatter: `name` (required, lowercase-hyphen), `description` (required, 1-1024 chars)
- Body: markdown instructions — có thể dài (hàng trăm dòng)
- Location: `~/.config/opencode/skills/<name>/SKILL.md`, `.opencode/skills/`, `~/.claude/skills/`
- Permission: configurable per-agent (`allow`, `deny`, `ask`)

```yaml
# ~/.config/opencode/skills/api-conventions/SKILL.md
---
name: api-conventions
description: REST API design conventions for this organization. Load when creating or modifying API endpoints.
---
## Endpoint Naming
- Use plural nouns: /users, /orders
- Nest resources: /users/{id}/orders
...
```

### 1.4. Tool — Primitive operations

**Bản chất**: Functions mà agent gọi để tương tác với system. Built-in: bash, read, write, edit, grep, glob, list, webfetch, websearch, skill, todowrite, task (launch subagent).

**Quan hệ với agent**: Agent có permission config quyết định tool nào được dùng.

**Quan hệ với command**: Command KHÔNG có tool config riêng — kế thừa từ agent chạy nó.

---

## 2. Decision Framework

### 2.1. Flowchart quyết định

```
Bạn muốn thêm behavior mới cho OpenCode?
│
├─ 1) Bạn cần KIỂM SOÁT tools/permissions KHÁC với agent hiện có?
│    ├─ CÓ → Tạo AGENT
│    │   ├─ User tương tác trực tiếp? → Primary agent
│    │   └─ Được gọi bởi agent khác? → Subagent
│    └─ KHÔNG ↓
│
├─ 2) Bạn gõ cùng một prompt LẶP ĐI LẶP LẠI?
│    ├─ CÓ → Tạo COMMAND
│    │   ├─ Output dài, ô nhiễm context? → subtask: true
│    │   └─ Output ngắn, muốn thấy ngay? → inline (default)
│    └─ KHÔNG ↓
│
├─ 3) Bạn có domain knowledge mà agent CẦN NHƯNG KHÔNG PHẢI LÚC NÀO CŨNG CẦN?
│    ├─ CÓ → Tạo SKILL
│    └─ KHÔNG ↓
│
├─ 4) Bạn cần hook vào EVENTS hoặc tạo CUSTOM TOOLS?
│    ├─ CÓ → Tạo PLUGIN
│    └─ KHÔNG → Không cần extension. Nói chuyện với agent hiện tại.
```

### 2.2. Quick reference table

| Tình huống | Primitive | Lý do |
|---|---|---|
| "Mỗi lần tôi đều gõ cùng prompt này" | **Command** | Prompt shortcut, đỡ gõ lại |
| "Tôi cần review code mà agent không được sửa file" | **Agent** (subagent) | Cần permissions khác |
| "Task này chạy lâu, output nhiều, đừng ô nhiễm chat" | **Command** + `subtask: true` | Isolation mà không cần define agent |
| "Agent cần biết conventions nhưng không phải lúc nào cũng cần" | **Skill** | On-demand knowledge, agent tự load |
| "Tôi muốn dùng model khác cho task này" | **Agent** hoặc Command + `model:` | Model override |
| "Tôi cần chạy song song nhiều task" | **Subagent** (via Task tool) | Mỗi Task = 1 isolated session |
| "Tôi cần intercept tool calls" | **Plugin** | Event hooks |
| "Tôi cần gọi external API như 1 tool" | **Plugin** (custom tool) hoặc **MCP server** | Tool injection |

### 2.3. Quy tắc vàng

1. **Bắt đầu bằng thứ đơn giản nhất** — thử command trước, nếu không đủ thì lên agent
2. **Command + agent field > tạo agent mới** — đừng tạo agent chỉ vì muốn prompt khác
3. **Skill > dài prompt trong command** — nếu instructions > 50 dòng, chuyển thành skill
4. **subtask: true > tạo subagent** — nếu chỉ cần isolation, không cần persona riêng
5. **Một hidden subagent > nhiều subagents** — reuse 1 worker cho nhiều commands

---

## 3. Agent vs Subagent — Phân Tích Sâu

### 3.1. Primary Agent: Khi nào tạo, khi nào không

**Tạo primary agent khi**:
- Bạn dành **nhiều thời gian** trong mode này (ví dụ: "planning mode" vs "building mode")
- Cần **model khác** tối ưu cho task type (reasoning model cho plan, fast model cho build)
- Cần **permissions khác fundamentally** (plan: read-only, build: full access)
- Bạn muốn **switch qua lại** giữa các mode trong 1 session

**KHÔNG tạo primary agent khi**:
- Chỉ cần chạy 1 task rồi quay lại — dùng command
- Chỉ khác prompt, không khác model/permissions — dùng command + skill
- Task chạy ngầm, user không cần tương tác — dùng subagent

**Heuristic**: Nếu bạn không **Tab sang** agent này ít nhất vài lần mỗi ngày, nó không nên là primary agent.

**Ví dụ tốt**: Build agent (default, full tools) + Plan agent (restricted, analysis only). Đây là 2 "modes of thinking" khác nhau fundamentally.

**Ví dụ xấu**: Tạo `test-runner` primary agent chỉ để chạy tests. → Dùng `/test` command thay thế.

### 3.2. Subagent: Khi nào tạo, khi nào không

**Tạo subagent khi**:
- Cần **permissions khác** mà command không thể override (ví dụ: deny edit)
- Cần **model khác** cho task cụ thể (ví dụ: cheap model cho docs)
- Cần **parallel execution** — primary agent dispatch nhiều Tasks đồng thời
- Task produce **output lớn** mà bạn KHÔNG muốn trong main context
- Subagent cần **system prompt đặc biệt** (persona, constraints)

**KHÔNG tạo subagent khi**:
- Chỉ cần isolation → `subtask: true` trên command đã đủ
- Chỉ chạy 1 lần, không reuse → inline command
- Task ngắn, output ít → chạy trực tiếp trong main agent

**Heuristic**: Subagent = "nhân viên có chuyên môn riêng". Nếu task không cần chuyên môn riêng, đừng tạo nhân viên mới.

### 3.3. Command subtask:true vs Explicit subagent

```
                    ┌──────────────────────────────────────┐
                    │         Cần isolation?                │
                    └───────────────┬──────────────────────┘
                                    │
                            ┌───────┴────────┐
                            │                │
                        CÓ                  KHÔNG
                            │                │
                    ┌───────┴────────┐       └─→ Inline command
                    │                │
            Cần permissions    Chỉ cần
            /model riêng?     fresh context?
                    │                │
                CÓ              KHÔNG
                    │                │
            Explicit        subtask: true
            subagent            command
```

**`subtask: true` command**:
- Chạy command trong session con
- Kế thừa agent hiện tại (model, permissions)
- Đơn giản, không cần define agent file
- Kết quả return về main session dưới dạng summary

**Explicit subagent**:
- Agent file riêng với model/permissions/prompt riêng
- Có thể hidden (chỉ gọi programmatically)
- Reusable — nhiều commands có thể target cùng 1 subagent
- Có thể limit steps (kiểm soát cost)

**Khi nào chuyển từ `subtask:true` sang explicit subagent**: Khi bạn thấy mình cần thêm `agent: <name>` vào command VÀ cần permissions/model khác với agent hiện tại.

---

## 4. Mô Hình Orchestrator → Subagents

### 4.1. Mô hình là gì?

Nhiều developer tạo setup sau:

```
┌─────────────────────────────────┐
│       Orchestrator Agent        │
│  (primary, reasoning model)     │
│                                 │
│  Quyết định task → dispatch     │
│  Nhận results ← tổng hợp       │
└───────┬─────────┬───────┬───────┘
        │         │       │
   Task tool  Task tool  Task tool
        │         │       │
        ▼         ▼       ▼
   ┌─────────┐ ┌──────┐ ┌──────────┐
   │ Coder   │ │Review│ │ Tester   │
   │subagent │ │subagt│ │ subagent │
   │(Sonnet) │ │(read)│ │(Haiku)   │
   └─────────┘ └──────┘ └──────────┘
```

Orchestrator giữ "big picture", subagents xử lý tasks cụ thể. Kết quả subagent return về orchestrator dưới dạng summary ngắn gọn.

### 4.2. Khi nào Orchestrator model HỢP LÝ

#### ✅ Tốt: Parallel independent tasks

```
User: "Implement auth, add logging, write docs"

Orchestrator nhận ra 3 tasks KHÔNG PHỤ THUỘC nhau:
→ Task(coder, "Implement auth middleware")
→ Task(coder, "Add structured logging to services")  
→ Task(docs-writer, "Write API documentation")

3 subagents chạy song song. Orchestrator tổng hợp kết quả.
```

**Tại sao tốt**: 3x speedup, mỗi subagent có context sạch, không conflict.

#### ✅ Tốt: Research → Decide → Execute

```
User: "Migrate our REST API to GraphQL"

Orchestrator:
1. Task(explore, "Survey all REST endpoints and their consumers")
2. Task(explore, "Research GraphQL best practices for our tech stack")
3. Orchestrator đọc 2 summaries → tạo migration plan
4. Task(coder, "Implement GraphQL schema based on plan")
```

**Tại sao tốt**: Research phase có output rất lớn (file reads, grep results). Giữ trong subagent = orchestrator context sạch. Orchestrator chỉ nhận distilled summary.

#### ✅ Tốt: Code → Review → Fix loop

```
User: "Add payment processing"

Orchestrator:
1. Task(coder, "Implement Stripe integration")
2. Task(reviewer, "Review uncommitted changes for security issues")
3. Reviewer báo 2 issues → Orchestrator truyền cho coder
4. Task(coder, "Fix: [issue 1], [issue 2]")
5. Task(tester, "Run test suite, report failures")
```

**Tại sao tốt**: Review/test output không ô nhiễm coding context. Orchestrator là "project manager" — nhìn toàn cảnh, delegate chi tiết.

### 4.3. Khi nào Orchestrator model KHÔNG HỢP LÝ

#### ❌ Xấu: Sequential dependent tasks

```
User: "Add a button that calls the new API"

Orchestrator:
1. Task(coder, "Create API endpoint")
   → Coder tạo /api/submit ở src/routes/submit.ts
2. Task(coder, "Create button that calls the API")
   → Coder KHÔNG BIẾT endpoint ở đâu, format response thế nào
   → Phải guess hoặc scan lại toàn bộ codebase
```

**Tại sao xấu**: Subagent 2 KHÔNG CÓ context từ subagent 1. Orchestrator phải truyền context thủ công → thêm tokens, dễ miss details. **Single agent làm cả 2 steps nhanh hơn và chính xác hơn.**

**Quy tắc**: Nếu task B phụ thuộc output chi tiết của task A, ĐỪNG tách thành 2 subagents. Single agent giữ full context sẽ tốt hơn.

#### ❌ Xấu: Over-delegation cho micro-tasks

```
User: "Fix this typo in the README"

Orchestrator:
→ Task(explore, "Find the typo location")
→ Task(coder, "Fix the typo")
→ Task(reviewer, "Verify the fix")
```

**Tại sao xấu**: 3 subagent sessions, 3x API cost, 3x latency — cho 1 dòng edit. Build agent sửa trực tiếp trong 1 step.

**Quy tắc**: Nếu task đủ nhỏ để single agent hoàn thành trong <10 tool calls, ĐỪNG delegate.

#### ❌ Xấu: Interactive tasks trong subagent

```
User: "Help me design the database schema"

Orchestrator:
→ Task(coder, "Design database schema for e-commerce")
→ Coder tạo schema... nhưng cần hỏi user:
   "Do you want soft delete or hard delete?"
   → KHÔNG THỂ HỎI — subagent không có direct user access
   → Guess → sai → phải redo
```

**Tại sao xấu**: Subagent chạy trong session riêng, không thể hỏi user mid-task (trừ khi dùng `question` tool). Tasks cần discussion phải ở main conversation.

**Quy tắc**: Nếu task cần multi-turn discussion với user, ĐỪNG delegate tới subagent.

#### ❌ Xấu: "Orchestrator" chỉ relay messages

```
Orchestrator nhận "implement feature X"
→ Task(coder, "implement feature X")    # chỉ forward nguyên prompt
→ Nhận result
→ Return result cho user                # chỉ forward nguyên result
```

**Tại sao xấu**: Orchestrator là middleman không thêm giá trị. Cùng model, cùng prompt — thêm 1 layer overhead vô ích. User nói trực tiếp với build agent nhanh hơn.

**Quy tắc**: Nếu orchestrator chỉ forward prompt → nhận result → forward result, nó đang waste tokens. Bỏ orchestrator, nói trực tiếp với agent thực thi.

### 4.4. Context loss problem — Vấn đề cốt lõi

Đây là vấn đề lớn nhất của mô hình orchestrator:

```
Orchestrator context:  [user request] [plan] [summary1] [summary2]
Subagent A context:    [task instruction] [file reads] [code] [tests]
Subagent B context:    [task instruction] [file reads] [code] [tests]
```

**Mất gì?**
- Subagent A không biết subagent B đang làm gì
- Subagent A không biết orchestrator đã quyết định gì trước đó
- Orchestrator chỉ biết summary — mất chi tiết implementation

**Khi nào chấp nhận được?**
- Tasks THỰC SỰ independent — A không cần biết B
- Summary đủ thông tin cho orchestrator quyết định tiếp
- Task nhỏ — subagent không cần nhiều context

**Khi nào KHÔNG chấp nhận được?**
- Tasks có shared state (cùng sửa 1 file)
- Cần chi tiết implementation (function signatures, variable names)
- Task phức tạp cần reasoning dài — summary mất nuance

### 4.5. Tổng hợp: Orchestrator model decision matrix

| Tình huống | Orchestrator? | Lý do |
|---|---|---|
| 3+ tasks independent, parallel | ✅ Có | Speedup, isolation |
| Research + decide + execute | ✅ Có | Research messy, orchestrator clean |
| Code + review + fix loop | ✅ Có | Review isolated, clean feedback |
| 2 tasks, B phụ thuộc detail A | ❌ Không | Context loss, single agent tốt hơn |
| Micro-task (<10 tool calls) | ❌ Không | Overhead > benefit |
| Interactive design discussion | ❌ Không | Subagent không thể multi-turn với user |
| Relay-only orchestrator | ❌ Không | Middleman vô ích |
| Mixed: some parallel, some dependent | ⚠️ Hybrid | Parallel phần independent, sequential phần dependent |

---

## 5. Các Anti-Patterns Phổ Biến

### 5.1. "Agent cho mỗi task" (Agent Sprawl)

**Triệu chứng**: 10+ agents, mỗi cái cho 1 task type — `lint-agent`, `test-agent`, `format-agent`, `deploy-agent`...

**Vấn đề**:
- Quá nhiều agents → khó nhớ dùng cái nào
- Mỗi agent = 1 system prompt dài → token overhead
- Agent không reusable — quá specific
- Maintenance nightmare — đổi 1 convention phải sửa 10 agents

**Fix**: Commands target build agent, skills cho domain knowledge. 2-3 agents là đủ cho hầu hết projects.

### 5.2. "Command chứa cả cuốn sách" (Command Bloat)

**Triệu chứng**: Command file 200+ dòng, chứa full instructions, examples, edge cases.

**Vấn đề**:
- Command inject TOÀN BỘ content vào prompt MỖI LẦN chạy
- Tốn tokens ngay cả khi agent không cần phần lớn content
- Không reusable — instructions locked trong 1 command

**Fix**: Chuyển instructions dài thành skill. Command chỉ nên là trigger: "Load skill X, then do Y with $ARGUMENTS".

### 5.3. "Subagent cho read-only query" (Unnecessary Isolation)

**Triệu chứng**: Tạo subagent hoặc subtask command cho mọi thứ, kể cả query đơn giản.

**Vấn đề**:
- Mỗi subagent session = overhead (session creation, system prompt load)
- Context switch: user phải navigate parent ↔ child sessions
- Summary có thể mất details quan trọng

**Fix**: Nếu output < 50 dòng và read-only → inline trong main agent.

### 5.4. "Orchestrator biết tuốt" (God Orchestrator)

**Triệu chứng**: Orchestrator agent có system prompt 500+ dòng, quản lý mọi workflow, dispatch mọi task.

**Vấn đề**:
- System prompt quá dài → model attention degraded
- Orchestrator trở thành bottleneck — mọi thứ phải qua nó
- Khi orchestrator sai → TOÀN BỘ pipeline sai

**Fix**: Orchestrator nên lean — chỉ coordinate. Logic cụ thể ở skills, không ở orchestrator prompt.

### 5.5. "Shared file, parallel subagents" (Race Condition)

**Triệu chứng**: 2 subagents cùng edit 1 file đồng thời.

**Vấn đề**:
- Subagent A đọc file → sửa → write
- Subagent B đọc file (bản cũ) → sửa → write
- B overwrite changes của A → silent data loss

**Fix**: 
- Đảm bảo parallel subagents work trên DIFFERENT files
- Nếu phải chạy trên cùng file → chạy sequential, không parallel
- Hoặc dùng file reservation mechanism (Agent Mail pattern)

---

## 6. Patterns Hiệu Quả Trong Thực Tế

### 6.1. Plan → Build (2 Primary Agents)

Đây là setup phổ biến nhất và đã proven effective:

```
PLAN agent                          BUILD agent
(reasoning model, restricted)       (fast model, full tools)
│                                   │
├─ Analyze codebase                 ├─ Write code
├─ Create implementation plan       ├─ Run tests
├─ Review architecture              ├─ Fix bugs
├─ Suggest approaches               ├─ Refactor
│                                   │
│ ← Tab switch →                    │
```

**Tại sao 2 là đủ**: Phản ánh 2 modes of thinking — "nghĩ" vs "làm". Thêm agent thứ 3 hiếm khi thêm giá trị.

**Model mixing hiệu quả**:
- Plan: GPT-5.x Codex (high reasoning) hoặc Claude Opus
- Build: Claude Sonnet (fast, good at coding)

### 6.2. Command + Subtask cho workflows lặp lại

```yaml
# /implement — Plan agent tạo plan, rồi dispatch tới coder
---
description: Plan then implement a feature
agent: plan
---
Analyze what needs to be done for: $ARGUMENTS

Create a clear step-by-step plan, then use the Task tool 
to have the build agent implement each step.
```

Pattern này:
- Plan agent nghĩ trước, build agent làm
- Build runs as subtask → clean context cho plan
- Plan chỉ nhận summary results

### 6.3. Explore subagent cho research

```yaml
# Explore = built-in subagent, read-only, fast
@explore How does error handling work in this codebase?
@explore Find all database migration files and explain the pattern
```

**Tại sao hiệu quả**: 
- Research output thường rất dài (nhiều file reads)
- Explore chạy trong session riêng → main context sạch
- Explore read-only → an toàn, không sửa code vô tình
- Kết quả return về main agent dưới dạng summary

### 6.4. Review subagent với restricted permissions

```yaml
# ~/.config/opencode/agents/reviewer.md
---
description: Code review without ability to modify
mode: subagent
permission:
  edit: deny
  bash:
    "*": ask
    "git diff*": allow
    "git log*": allow
    "npm test*": allow
---
Review code thoroughly. You cannot modify files.
Report issues with severity (critical/major/minor).
Suggest fixes as code snippets the user can apply.
```

**Tại sao cần agent thay vì command**: Permission deny trên edit — command không thể override permissions. Phải là agent riêng.

### 6.5. Hidden worker cho parallel execution

```yaml
# ~/.config/opencode/agents/worker.md
---
description: General purpose worker for parallel task execution
mode: subagent
hidden: true
steps: 50
permission:
  edit: allow
  bash:
    "*": allow
    "git push*": deny
---
You are a focused worker agent. Execute the assigned task completely.
Report results concisely when done. Do not expand scope.
```

Primary agent dispatch:
```
# User: "Run these 3 tasks in parallel"
Task(agent="worker", prompt="Implement feature A in src/a.ts")
Task(agent="worker", prompt="Implement feature B in src/b.ts")
Task(agent="worker", prompt="Write tests for module C")
```

**Tại sao hidden**: User không cần @mention worker trực tiếp. Chỉ primary agent gọi.

---

## 7. Context Rot và Cách Subagent Giải Quyết

### 7.1. Context rot là gì?

Khi session dài, mỗi message/tool call/file read thêm tokens vào context window. Sau một thời gian:

- Model bắt đầu **quên instructions đầu tiên** (lost in the middle effect)
- **Signal-to-noise ratio** giảm — quyết định architecture từ đầu session bị nhấn chìm bởi error logs, test output
- Model **contradict chính mình** — quên quyết định trước đó
- Code quality **giảm rõ rệt** so với đầu session

### 7.2. Research cho thấy gì?

Stanford "Lost in the Middle" paper: Models chú ý mạnh nhất ở **đầu** và **cuối** context window. Thông tin ở **giữa** bị systematically underweight — kể cả khi vẫn trong context window.

Implication: 20 tool calls đầu (orientation) diễn ra khi model sharpest. Code writing ở cuối khi attention đã degraded.

### 7.3. Subagent = Context firewall

```
Không dùng subagent:
Main context: [instructions][plan][file1][file2]...[file20][grep1]...[grep10][code1][test1][error][fix][test2]...
→ 50K+ tokens, model quên plan ở đầu

Dùng subagent:
Main context:      [instructions][plan][summary: "auth implemented, 3 tests pass"][summary: "docs updated"]
→ 2K tokens, model nhớ rõ plan

Subagent context:  [task][file1]...[file20][code][test][error][fix][test2]
→ Discarded sau khi return summary
```

**Nguyên tắc**: Subagent là **vùng chứa rác tạm thời**. Toàn bộ "mess" của exploration/debugging/trial-error nằm trong subagent. Orchestrator chỉ nhận kết quả sạch.

### 7.4. Khi nào context rot là real problem?

| Session length | Risk | Mitigation |
|---|---|---|
| < 20 messages | Thấp | Không cần subagent |
| 20-50 messages | Trung bình | Subtask commands cho tasks lớn |
| 50-100 messages | Cao | Subagents cho mọi task > 5 tool calls |
| > 100 messages | Rất cao | Compaction + subagents, hoặc new session |

---

## 8. Thiết Kế Cho Project Thực Tế

### 8.1. Minimal setup (đủ cho 90% projects)

```
~/.config/opencode/
├── opencode.json              # model config, provider keys
├── agents/                    # (empty hoặc 1-2 custom agents)
├── commands/
│   ├── test.md                # /test — run tests
│   ├── review.md              # /review — review changes
│   └── commit.md              # /commit — format commit message
└── skills/
    └── project-conventions/
        └── SKILL.md           # coding standards
```

Dùng built-in Build + Plan agents. Commands cho workflows lặp lại. 1 skill cho project conventions.

### 8.2. Production setup (team project)

```
.opencode/                     # per-project, committed to git
├── agents/
│   └── reviewer.md            # read-only review agent
├── commands/
│   ├── implement.md           # /implement — plan then code
│   ├── review-pr.md           # /review-pr — review PR changes
│   └── deploy-check.md        # /deploy-check — pre-deploy validation
├── skills/
│   ├── api-conventions/
│   │   └── SKILL.md
│   └── testing-standards/
│       └── SKILL.md
└── plugins/
    └── env-protection.js      # block reading .env files

~/.config/opencode/            # global, personal
├── opencode.json
└── agents/
    └── worker.md              # hidden worker for parallel tasks
```

### 8.3. Checklist thiết kế

Trước khi tạo bất kỳ extension nào, hỏi:

- [ ] **Tôi đã thử nói trực tiếp với build agent chưa?** → Có thể không cần extension
- [ ] **Tôi gõ prompt này > 3 lần/ngày?** → Command
- [ ] **Instructions > 50 dòng?** → Skill, không phải command body
- [ ] **Cần permissions khác?** → Agent
- [ ] **Cần chạy song song?** → Hidden subagent
- [ ] **Output > 50 dòng và không cần trong main chat?** → subtask: true
- [ ] **Task cần multi-turn discussion?** → Main agent, KHÔNG subagent
- [ ] **Cần hook events?** → Plugin (hiếm khi cần)

---

## Phụ lục: So sánh mindset

### Microservices analogy

| Monolith | Microservices | Tương đương OpenCode |
|---|---|---|
| 1 app làm mọi thứ | Nhiều services nhỏ | 1 build agent vs nhiều subagents |
| Simple, fast | Complex, overhead | Direct execution vs delegation |
| Shared state dễ | Distributed state khó | Single context vs context loss |
| Scale kém | Scale tốt | Context rot vs clean contexts |

**Bài học từ microservices**: Đừng tách thành microservices quá sớm. Monolith đủ tốt cho hầu hết cases. Chỉ tách khi có bottleneck thực sự.

Tương tự: **Đừng tạo subagents quá sớm. Single agent đủ tốt cho hầu hết tasks. Chỉ delegate khi context rot thực sự xảy ra hoặc cần parallel.**

### Developer team analogy

| Vai trò | OpenCode equivalent |
|---|---|
| **Tech Lead** | Primary agent (Plan mode) |
| **Senior Dev** | Primary agent (Build mode) |
| **Junior Dev** | Subagent — nhận task cụ thể, báo kết quả |
| **Intern** | Command subtask — làm 1 việc, xong thì hết |
| **Consultant** | Skill — gọi khi cần expertise, không full-time |
| **Meeting** | Command inline — quick sync, mọi người nghe |
| **Async task** | Command subtask — đi làm riêng, báo sau |
| **Pair programming** | User + primary agent trực tiếp |
| **Code review** | Subagent reviewer — independent, read-only |

**Bài học**: Đừng thuê 10 "nhân viên" (agents) khi 2 người + vài consultant (skills) là đủ. Overhead quản lý team lớn > benefit.
