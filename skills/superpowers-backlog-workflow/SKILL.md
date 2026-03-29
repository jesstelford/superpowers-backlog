---
name: superpowers-backlog-workflow
description: Use when the user is ready to start a new body of work — asking what to work on next, wanting to pick something to build, or saying "let's start on X", "what's next", or "I want to work on".
---

# superpowers-backlog Workflow

> Not ready to implement yet? Use `superpowers-backlog-manage` to capture the idea first.

Combines `epics.mjs` prioritisation with the superpowers subagent-driven-development pipeline. `epics.mjs` decides *what* to work on; the superpowers skills handle *how*.

## Adding epics to the backlog

**REQUIRED SUB-SKILL:** Use `superpowers-backlog-manage`

## Implementing an epic

```
1. Pick     superpowers-backlog skill  →  run with --pending --limit 5 --with-context
2. Start    superpowers-backlog skill  →  run with --start <id>
3. Worktree superpowers:using-git-worktrees
4. Think    superpowers:brainstorming        (seed with --with-context output)
5. Plan     superpowers:writing-plans        (final plan step: epics.mjs --complete <id>)
6. Execute  superpowers:subagent-driven-development
7. Finish   superpowers:finishing-a-development-branch
```

For steps 1–2, **REQUIRED SUB-SKILL:** Use `superpowers-backlog`

## Critical rules

**`--with-context` is mandatory when picking** — pass its output directly to brainstorming and writing-plans as the epic spec.

**`epics.mjs --complete <id>` belongs in the plan, not after it** — add it as the final step of the plan document so the implementer subagent runs it automatically.

**`using-git-worktrees` before brainstorming** — `subagent-driven-development` requires an isolated branch.

**Do not insert extra skills between execute and finish** — `finishing-a-development-branch` already covers verification and code review.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Picking without `--with-context` | Always use it — the inlined source is the spec |
| Putting `--complete` after `finishing-a-development-branch` | Put it in the plan; the subagent runs it |
| Skipping the worktree | Required — subagents need an isolated branch |
| Adding `verification-before-completion` separately | Redundant — covered by `finishing-a-development-branch` |
