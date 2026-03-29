---
name: superpowers-backlog
description: Use when the user wants to see the backlog, asks what to work on next, searches for specific epics, or asks whether something has been captured — including "what's highest priority", "show me epics about X", "what's next for Y", or "do we have anything for Z".
---

# superpowers-backlog Commands

The script lives at `~/.claude/skills/superpowers-backlog/epics.mjs` and runs in any project directory — no installation needed. It reads and writes `EPICS.json` in the current working directory (`process.cwd()`).

## Commands

```bash
# List top incomplete epics with context and inlined references
node ~/.claude/skills/superpowers-backlog/epics.mjs --pending --limit 5 --with-context

# All incomplete epics (no context)
node ~/.claude/skills/superpowers-backlog/epics.mjs --pending

# Search by keyword (read-only — searches id, description, and context)
node ~/.claude/skills/superpowers-backlog/epics.mjs --search <term>
node ~/.claude/skills/superpowers-backlog/epics.mjs --search <term> --with-context

# Mark an epic in-progress
node ~/.claude/skills/superpowers-backlog/epics.mjs --start <id-or-search>

# Mark an epic completed
node ~/.claude/skills/superpowers-backlog/epics.mjs --complete <id-or-search>

# Show completed epics
node ~/.claude/skills/superpowers-backlog/epics.mjs --filter-completed
```

`<id-or-search>` matches exact `id` first, then falls back to case-insensitive substring of the epic description.

## Answering topic-filtered queries

When the user asks "what's next for X?" or "what's highest priority for the Y area?", use `--search <keyword>` to narrow candidates, then `--pending` with judgement applied. There is no built-in topic filter.

## `--with-context` flag

When picking an epic to implement, always use `--with-context`. It inlines:
- The `context` field (free-form background text)
- All `references` — file ranges are read and inlined; URLs are listed but not fetched

This output is the primary spec input for brainstorming and planning.

## First-time project setup

**1. Create `EPICS.json`** in the project root:
```json
[]
```
If the file doesn't exist, all read commands return an empty list.

**2. Add to `CLAUDE.md`:**
```
Never read `EPICS.json` directly. All epic state is managed through the superpowers-backlog skill.
```

## Epic fields

| Field | Type | Meaning |
|-------|------|---------|
| `id` | kebab-case string | Stable identifier for `--start` / `--complete` / `--search` |
| `epic` | string | Human-readable description |
| `status` | `null` / `"in-progress"` / `"completed"` | Lifecycle state |
| `context` | string (optional) | Free-form background, constraints, or notes |
| `references` | string[] (optional) | Files (`path:start-end`, `path:line`, `path`) or URLs |
| `user_impact` | 0–1 | End-user value (scoring weight 0.50) |
| `code_quality_impact` | 0–1 | Correctness / tech debt (weight 0.30) |
| `extensibility_impact` | 0–1 | Future development leverage (weight 0.20) |
| `complexity` | 0–1 | Technical difficulty — penalises score via `complexity^1.5 × 0.30` |
