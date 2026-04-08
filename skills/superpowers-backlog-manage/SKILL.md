---
name: superpowers-backlog-manage
description: Use when the user wants to capture a new idea, feature, or bug OR update an existing epic — including "add X to the backlog", "we should also handle Y", "update the Z epic to include", "change the description of", or any half-formed thought they want to record for later.
---

# Managing Epics

Covers two operations: **adding** new epics and **editing** existing ones. Both write to `EPICS.json` via the `superpowers-backlog` script.

## Locating the script

`epics.mjs` lives in the `superpowers-backlog` skill directory (sibling skill to this one). Determine the absolute path from this SKILL.md's location:

```
EPICS_SCRIPT="<parent directory of this SKILL.md>/../superpowers-backlog/epics.mjs"
```

All commands below use `$EPICS_SCRIPT` as a placeholder — substitute the resolved absolute path.

## Adding a new epic

Evaluate the item and append a rated entry to `EPICS.json`. Process **one item at a time**.

### Process

1. **Write the `epic` description** — one clear sentence describing the goal.

2. **Write `context`** (optional but encouraged) — anything that wouldn't be obvious from the name alone: background, constraints, prior decisions, relevant design notes. This is shown to agents when they pick the epic to implement.

3. **Populate `references`** (optional) — list files, line ranges, or URLs relevant to the epic. Formats:
   - `"src/path/to/file.ts:10-50"` — specific line range
   - `"src/path/to/file.ts:10"` — from line 10 to next section boundary
   - `"src/path/to/file.ts"` — first 20 lines
   - `"https://..."` — URL (listed but not inlined by `--with-context`)

4. **Rate across four dimensions** (each 0.0–1.0):

   | Field | What to measure | 0.0 | 1.0 |
   |-------|----------------|-----|-----|
   | `complexity` | Technical difficulty of the solution | Trivial (change one value) | Extremely complex (new subsystem, research required) |
   | `user_impact` | Effect on end-user experience or capability | Invisible to users | Transformative (core workflow change) |
   | `code_quality_impact` | Effect on code quality and technical debt | Introduces debt or regression | Significantly improves architecture |
   | `extensibility_impact` | Effect on future development | Makes future work harder | Greatly enables future features |

   **Do not factor in effort, time, or development speed.** `complexity` is technical difficulty only.

5. **Generate an `id`** — short kebab-case slug. Used in `--start` / `--complete` / `--edit` / `--search` commands.

6. **Add via the script:**

```bash
node $EPICS_SCRIPT --add \
  --id <kebab-case-id> \
  --epic "Clear, concise description of what needs doing" \
  --context "Optional background or constraints" \
  --complexity 0.3 \
  --user-impact 0.7 \
  --code-quality-impact 0.4 \
  --extensibility-impact 0.6 \
  --ref "src/relevant/file.ts:10-40" \
  --ref "https://example.com/design-doc"
```

All flags except `--id` and `--epic` are optional. `--ref` can be repeated. The epic is created with `status: null`.

### Example

User: "We should show a loading spinner while transactions are fetching — and make sure it doesn't flicker on fast connections"

```bash
node $EPICS_SCRIPT --add \
  --id transaction-list-loading-spinner \
  --epic "Show loading spinner while transactions are fetching" \
  --context "Should not flicker on fast connections — add a minimum display duration of ~150ms. The list currently shows nothing while loading." \
  --complexity 0.2 \
  --user-impact 0.6 \
  --code-quality-impact 0.3 \
  --extensibility-impact 0.2 \
  --ref "src/components/transactions/TransactionList.tsx:1-30"
```

## Editing an existing epic

### Scalar fields (`epic`, `context`, scoring)

```bash
# Update the description
node $EPICS_SCRIPT --edit <id-or-search> --field epic --value "New description"

# Update or add context
node $EPICS_SCRIPT --edit <id-or-search> --field context --value "Minimum display duration of 150ms to avoid flicker"

# Update a scoring field
node $EPICS_SCRIPT --edit <id-or-search> --field user_impact --value 0.9
```

### References array

```bash
# Add a reference
node $EPICS_SCRIPT --edit <id-or-search> --add-ref "src/hooks/useTransactions.ts:1-50"
node $EPICS_SCRIPT --edit <id-or-search> --add-ref "https://example.com/spec"

# Remove a reference (exact string match)
node $EPICS_SCRIPT --edit <id-or-search> --remove-ref "src/old/path.ts:1-20"
```

`<id-or-search>` matches exact `id` first, then falls back to case-insensitive substring of the epic description. Numeric fields (`complexity`, `user_impact`, `code_quality_impact`, `extensibility_impact`) are automatically coerced from string to number.

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Leaving `context` empty | Add anything the implementer wouldn't know from the name alone |
| Rating `complexity` based on time estimate | Rate technical difficulty only — ignore calendar time |
| Referencing a directory instead of a file | `references` entries must be file paths or URLs |
| Long, wordy `id` | Keep it short — it's typed on the command line |
| Omitting `"status": null` when adding | Required field — omitting it breaks the status filter |
