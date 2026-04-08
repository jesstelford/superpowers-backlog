# superpowers-backlog

A set of agent skills for backlog management with impact-weighted prioritisation. Built on top of the [superpowers](https://github.com/obra/superpowers) skill suite — you'll want that installed first.

## Skills

| Skill | Purpose |
|-------|---------|
| `superpowers-backlog` | View, search, and query the backlog |
| `superpowers-backlog-manage` | Add and edit epics |
| `superpowers-backlog-workflow` | Full pipeline: pick → branch → brainstorm → plan → implement |

## How it works

Epics are stored in `EPICS.json` at your project root. Each epic has impact scores (`user_impact`, `code_quality_impact`, `extensibility_impact`) and a `complexity` penalty. The scoring algorithm ranks epics by:

```
score = (user_impact×0.50 + code_quality_impact×0.30 + extensibility_impact×0.20) − complexity^1.5×0.30
```

Scores are clamped to [0, 1]. This separates *value* from *effort* — high-impact, low-complexity epics float to the top.

Epics also support a `context` field (free-form background text) and a `references` array (file ranges or URLs) that are inlined when picking work, giving the agent full spec context before brainstorming begins.

## Installation

```bash
# Global (available in all projects)
npx skills add jesstelford/superpowers-backlog -g

# Project-scoped
npx skills add jesstelford/superpowers-backlog
```

## Getting started

1. Create `EPICS.json` in your project root:
   ```json
   []
   ```
2. Add to `CLAUDE.md`:
   ```
   Never read EPICS.json directly. All epic state is managed through the superpowers-backlog skill.
   ```
3. Ask your agent: *"add X to the backlog"* or *"what's highest priority?"*

## Dependencies

These skills reference the following skills from [superpowers](https://github.com/obra/superpowers):

- `superpowers:using-git-worktrees`
- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `superpowers:subagent-driven-development`
- `superpowers:finishing-a-development-branch`
