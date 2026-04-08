#!/usr/bin/env node

/**
 * Epic Prioritisation Script
 *
 * Ranking Algorithm
 * -----------------
 * Priority Score = (weighted_impact - complexity_penalty) normalised to [0, 1]
 *
 * Weighted impact combines three benefit dimensions:
 *   user_impact           weight 0.50  — end-user value is the primary driver
 *   code_quality_impact   weight 0.30  — correctness and maintainability
 *   extensibility_impact  weight 0.20  — future development leverage
 *
 * Complexity penalty applies a diminishing-returns curve so that moderately
 * complex epics are only lightly penalised while very complex epics are
 * penalised more heavily:
 *   penalty = complexity^1.5 * 0.30
 *
 * Final score is clamped to [0, 1].
 *
 * Epic schema
 * -----------
 *   id                   kebab-case identifier
 *   epic                 human-readable description
 *   status               null | "in-progress" | "completed"
 *   context              (optional) free-form background / detail text
 *   references           (optional) array of "path:start-end", "path:line", "path", or URLs
 *   complexity           0–1
 *   user_impact          0–1
 *   code_quality_impact  0–1
 *   extensibility_impact 0–1
 *
 * Usage
 * -----
 *   node epics.mjs
 *   node epics.mjs --limit 10
 *   node epics.mjs --pending                              Filter to incomplete epics
 *   node epics.mjs --filter-completed                    Filter to completed epics only
 *   node epics.mjs --with-context                        Inline context + file references
 *   node epics.mjs --search <term>                       Search epics by id, description, or context
 *   node epics.mjs --complete <id-or-search>             Mark an epic completed
 *   node epics.mjs --start    <id-or-search>             Mark an epic in-progress
 *   node epics.mjs --edit <id-or-search> --field <field> --value <value>
 *                                                        Update a field on an epic
 *   node epics.mjs --edit <id-or-search> --add-ref <ref>     Append a reference
 *   node epics.mjs --edit <id-or-search> --remove-ref <ref>  Remove a reference
 *   node epics.mjs --add --epic <desc> [--id <id>] [--context <text>]
 *                   [--complexity <0-1>] [--user-impact <0-1>]
 *                   [--code-quality-impact <0-1>] [--extensibility-impact <0-1>]
 *                   [--ref <ref> ...]                        Add a new epic
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const WEIGHTS = {
  user_impact: 0.50,
  code_quality_impact: 0.30,
  extensibility_impact: 0.20,
};

const COMPLEXITY_EXPONENT = 1.5;
const COMPLEXITY_WEIGHT = 0.30;

const NUMERIC_FIELDS = new Set(['complexity', 'user_impact', 'code_quality_impact', 'extensibility_impact']);

function score(epic) {
  const impact =
    (epic.user_impact ?? 0) * WEIGHTS.user_impact +
    (epic.code_quality_impact ?? 0) * WEIGHTS.code_quality_impact +
    (epic.extensibility_impact ?? 0) * WEIGHTS.extensibility_impact;

  const penalty = Math.pow(epic.complexity ?? 0, COMPLEXITY_EXPONENT) * COMPLEXITY_WEIGHT;

  return Math.max(0, Math.min(1, impact - penalty));
}

function loadEpics(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error(`Cannot read ${filePath}: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected an array in ${filePath}, got ${typeof parsed}`);
  }

  return parsed;
}

function findEpic(epics, search) {
  const byId = epics.find(e => e.id === search);
  if (byId) return byId;
  const lower = search.toLowerCase();
  return epics.find(e => e.epic?.toLowerCase().includes(lower)) ?? null;
}

function searchEpics(epics, term) {
  const lower = term.toLowerCase();
  return epics.filter(e =>
    e.id?.toLowerCase().includes(lower) ||
    e.epic?.toLowerCase().includes(lower) ||
    e.context?.toLowerCase().includes(lower)
  );
}

function setEpicStatus(filePath, search, status) {
  const epics = loadEpics(filePath);
  const epic = findEpic(epics, search);
  if (!epic) throw new Error(`No epic found matching: "${search}"`);
  epic.status = status;
  writeFileSync(filePath, JSON.stringify(epics, null, 2) + '\n');
  return epic;
}

/** Set a scalar field on an epic. Supports dot notation for nested fields. */
function setEpicField(filePath, search, field, value) {
  const epics = loadEpics(filePath);
  const epic = findEpic(epics, search);
  if (!epic) throw new Error(`No epic found matching: "${search}"`);

  const finalValue = NUMERIC_FIELDS.has(field) ? parseFloat(value) : value;

  const parts = field.split('.');
  let target = epic;
  for (let i = 0; i < parts.length - 1; i++) {
    if (target[parts[i]] == null || typeof target[parts[i]] !== 'object') {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = (NUMERIC_FIELDS.has(field) && !isNaN(finalValue)) ? finalValue : value;

  writeFileSync(filePath, JSON.stringify(epics, null, 2) + '\n');
  return epic;
}

/** Append or remove an entry from the references array. */
function mutateEpicRef(filePath, search, ref, action) {
  const epics = loadEpics(filePath);
  const epic = findEpic(epics, search);
  if (!epic) throw new Error(`No epic found matching: "${search}"`);

  if (!Array.isArray(epic.references)) epic.references = [];

  if (action === 'add') {
    if (!epic.references.includes(ref)) epic.references.push(ref);
  } else {
    epic.references = epic.references.filter(r => r !== ref);
    if (epic.references.length === 0) delete epic.references;
  }

  writeFileSync(filePath, JSON.stringify(epics, null, 2) + '\n');
  return epic;
}

/** Derive a kebab-case id from an epic description. */
function toKebabId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/** Add a brand-new epic to EPICS.json. */
function addEpic(filePath, epicData) {
  const epics = loadEpics(filePath);

  if (!epicData.epic) throw new Error('--add requires --epic');

  const id = epicData.id || toKebabId(epicData.epic);
  if (!id) throw new Error('Could not derive an id — provide --id explicitly');
  if (epics.some(e => e.id === id)) {
    throw new Error(`An epic with id "${id}" already exists`);
  }

  const entry = {
    id,
    epic: epicData.epic,
    status: null,
  };

  if (epicData.context != null) entry.context = epicData.context;
  if (epicData.references.length > 0) entry.references = epicData.references;

  entry.complexity = epicData.complexity ?? 0;
  entry.user_impact = epicData.user_impact ?? 0;
  entry.code_quality_impact = epicData.code_quality_impact ?? 0;
  entry.extensibility_impact = epicData.extensibility_impact ?? 0;

  epics.push(entry);
  writeFileSync(filePath, JSON.stringify(epics, null, 2) + '\n');
  return entry;
}

/**
 * Parse a reference string into its components.
 * Formats: "path:start-end", "path:line", "path", "https://..."
 */
function parseReference(ref) {
  if (ref.startsWith('http://') || ref.startsWith('https://')) {
    return { type: 'url', raw: ref };
  }

  const rangeMatch = ref.match(/^(.+):(\d+)-(\d+)$/);
  if (rangeMatch) {
    return { type: 'file', path: rangeMatch[1], startLine: parseInt(rangeMatch[2], 10), endLine: parseInt(rangeMatch[3], 10), raw: ref };
  }

  const lineMatch = ref.match(/^(.+):(\d+)$/);
  if (lineMatch) {
    return { type: 'file', path: lineMatch[1], startLine: parseInt(lineMatch[2], 10), endLine: null, raw: ref };
  }

  return { type: 'file', path: ref, startLine: null, endLine: null, raw: ref };
}

/**
 * Read content from a file reference.
 * - With startLine + endLine: returns that exact range.
 * - With startLine only: reads to the next `---` / `##` / `###` heading.
 * - With neither: returns first 20 lines.
 */
function readFileReference(parsed) {
  const filePath = resolve(process.cwd(), parsed.path);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const lines = content.split('\n');

  if (parsed.startLine == null) {
    return lines.slice(0, 20).join('\n').trimEnd();
  }

  const startIdx = Math.max(0, parsed.startLine - 1);

  if (parsed.endLine != null) {
    return lines.slice(startIdx, parsed.endLine).join('\n').trimEnd();
  }

  // Read to next section boundary
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---' || line.startsWith('### ') || line.startsWith('## ')) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx).join('\n').trimEnd();
}

function parseArgs(argv) {
  const args = {
    limit: null,
    filterCompleted: false,
    pending: false,
    withContext: false,
    search: null,
    complete: null,
    start: null,
    edit: null,
    field: null,
    value: null,
    addRef: null,
    removeRef: null,
    add: false,
    id: null,
    epic: null,
    context: null,
    complexity: null,
    userImpact: null,
    codeQualityImpact: null,
    extensibilityImpact: null,
    refs: [],
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') {
      const n = parseInt(argv[i + 1], 10);
      if (isNaN(n) || n < 1) throw new Error(`--limit requires a positive integer, got: ${argv[i + 1]}`);
      args.limit = n;
      i++;
    } else if (argv[i] === '--filter-completed') {
      args.filterCompleted = true;
    } else if (argv[i] === '--pending') {
      args.pending = true;
    } else if (argv[i] === '--with-context') {
      args.withContext = true;
    } else if (argv[i] === '--search') {
      if (!argv[i + 1]) throw new Error('--search requires a search term');
      args.search = argv[++i];
    } else if (argv[i] === '--complete') {
      if (!argv[i + 1]) throw new Error('--complete requires an epic id or search string');
      args.complete = argv[++i];
    } else if (argv[i] === '--start') {
      if (!argv[i + 1]) throw new Error('--start requires an epic id or search string');
      args.start = argv[++i];
    } else if (argv[i] === '--edit') {
      if (!argv[i + 1]) throw new Error('--edit requires an epic id or search string');
      args.edit = argv[++i];
    } else if (argv[i] === '--field') {
      if (!argv[i + 1]) throw new Error('--field requires a field name');
      args.field = argv[++i];
    } else if (argv[i] === '--value') {
      if (!argv[i + 1]) throw new Error('--value requires a value');
      args.value = argv[++i];
    } else if (argv[i] === '--add-ref') {
      if (!argv[i + 1]) throw new Error('--add-ref requires a reference string');
      args.addRef = argv[++i];
    } else if (argv[i] === '--remove-ref') {
      if (!argv[i + 1]) throw new Error('--remove-ref requires a reference string');
      args.removeRef = argv[++i];
    } else if (argv[i] === '--add') {
      args.add = true;
    } else if (argv[i] === '--id') {
      if (!argv[i + 1]) throw new Error('--id requires a value');
      args.id = argv[++i];
    } else if (argv[i] === '--epic') {
      if (!argv[i + 1]) throw new Error('--epic requires a value');
      args.epic = argv[++i];
    } else if (argv[i] === '--context') {
      if (!argv[i + 1]) throw new Error('--context requires a value');
      args.context = argv[++i];
    } else if (argv[i] === '--complexity') {
      if (!argv[i + 1]) throw new Error('--complexity requires a value');
      args.complexity = parseFloat(argv[++i]);
    } else if (argv[i] === '--user-impact') {
      if (!argv[i + 1]) throw new Error('--user-impact requires a value');
      args.userImpact = parseFloat(argv[++i]);
    } else if (argv[i] === '--code-quality-impact') {
      if (!argv[i + 1]) throw new Error('--code-quality-impact requires a value');
      args.codeQualityImpact = parseFloat(argv[++i]);
    } else if (argv[i] === '--extensibility-impact') {
      if (!argv[i + 1]) throw new Error('--extensibility-impact requires a value');
      args.extensibilityImpact = parseFloat(argv[++i]);
    } else if (argv[i] === '--ref') {
      if (!argv[i + 1]) throw new Error('--ref requires a value');
      args.refs.push(argv[++i]);
    } else if (argv[i].startsWith('--')) {
      throw new Error(`Unknown option: ${argv[i]}`);
    }
  }

  return args;
}

function bar(value, width = 10) {
  const filled = Math.round((value ?? 0) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function buildContextBlock(epic, withContext) {
  if (!withContext) return null;

  const lines = [];

  if (epic.context) {
    lines.push('│');
    lines.push('│ Context:');
    epic.context.split('\n').forEach(l => lines.push('│   ' + l));
  }

  if (Array.isArray(epic.references) && epic.references.length > 0) {
    lines.push('│');
    lines.push('│ References:');
    epic.references.forEach((ref, idx) => {
      const parsed = parseReference(ref);
      lines.push(`│   [${idx + 1}] ${ref}`);
      if (parsed.type === 'url') {
        lines.push('│       (URL — cannot inline)');
      } else {
        const content = readFileReference(parsed);
        if (content) {
          content.split('\n').forEach(l => lines.push('│       ' + l));
        } else {
          lines.push('│       (file not found)');
        }
      }
    });
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function formatEpic(rank, epic, priority, withContext) {
  const idLine     = epic.id     ? `│ ID        : ${epic.id}` : null;
  const statusLine = epic.status ? `│ Status    : ${epic.status}` : null;
  const contextBlock = buildContextBlock(epic, withContext);

  return [
    `┌─ #${rank}  [Score: ${priority.toFixed(3)}] ──────────────────────────────────────────`,
    `│ Epic      : ${epic.epic ?? '(no description)'}`,
    idLine,
    statusLine,
    `│`,
    `│ Metrics (0.0 – 1.0)`,
    `│   User Impact       ${bar(epic.user_impact)}  ${(epic.user_impact ?? 0).toFixed(2)}`,
    `│   Code Quality      ${bar(epic.code_quality_impact)}  ${(epic.code_quality_impact ?? 0).toFixed(2)}`,
    `│   Extensibility     ${bar(epic.extensibility_impact)}  ${(epic.extensibility_impact ?? 0).toFixed(2)}`,
    `│   Complexity        ${bar(epic.complexity)}  ${(epic.complexity ?? 0).toFixed(2)}`,
    contextBlock,
    `└──────────────────────────────────────────────────────────────────────`,
  ].filter(Boolean).join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = resolve(process.cwd(), 'EPICS.json');

  // Mutation commands — update EPICS.json and exit without rendering the report.
  if (args.add) {
    const epic = addEpic(filePath, {
      id: args.id,
      epic: args.epic,
      context: args.context,
      references: args.refs,
      complexity: args.complexity,
      user_impact: args.userImpact,
      code_quality_impact: args.codeQualityImpact,
      extensibility_impact: args.extensibilityImpact,
    });
    process.stdout.write(`✓ Added epic [${epic.id}]: ${epic.epic}  (score: ${score(epic).toFixed(3)})\n`);
    return;
  }

  if (args.complete !== null) {
    const epic = setEpicStatus(filePath, args.complete, 'completed');
    process.stdout.write(`✓ Marked completed: ${epic.epic}\n`);
    return;
  }

  if (args.start !== null) {
    const epic = setEpicStatus(filePath, args.start, 'in-progress');
    process.stdout.write(`▶ Marked in-progress: ${epic.epic}\n`);
    return;
  }

  if (args.edit !== null) {
    if (args.addRef !== null) {
      const epic = mutateEpicRef(filePath, args.edit, args.addRef, 'add');
      process.stdout.write(`✓ Added reference to [${epic.id}]: ${args.addRef}\n`);
      return;
    }
    if (args.removeRef !== null) {
      const epic = mutateEpicRef(filePath, args.edit, args.removeRef, 'remove');
      process.stdout.write(`✓ Removed reference from [${epic.id}]: ${args.removeRef}\n`);
      return;
    }
    if (!args.field) throw new Error('--edit requires --field <field> or --add-ref / --remove-ref');
    if (args.value === null) throw new Error('--edit requires --value <value>');
    const epic = setEpicField(filePath, args.edit, args.field, args.value);
    process.stdout.write(`✓ Updated [${epic.id}] ${args.field} = ${JSON.stringify(args.value)}\n`);
    return;
  }

  // Read commands.
  let epics = loadEpics(filePath);

  if (args.search !== null) {
    const results = searchEpics(epics, args.search);
    if (results.length === 0) {
      process.stdout.write(`No epics found matching: "${args.search}"\n`);
      return;
    }
    process.stdout.write(`${results.length} epic(s) matching "${args.search}":\n\n`);
    results.forEach((epic, i) => {
      process.stdout.write(formatEpic(i + 1, epic, score(epic), args.withContext));
      process.stdout.write('\n\n');
    });
    return;
  }

  if (args.filterCompleted) {
    epics = epics.filter(e => e.status === 'completed');
  } else if (args.pending) {
    epics = epics.filter(e => e.status !== 'completed');
  }

  if (epics.length === 0) {
    process.stdout.write('No epics match the given filters.\n');
    return;
  }

  const ranked = epics
    .map(e => ({ epic: e, priority: score(e) }))
    .sort((a, b) => b.priority - a.priority);

  const limited = args.limit ? ranked.slice(0, args.limit) : ranked;

  const filterLabel = args.filterCompleted ? '  [completed only]'
    : args.pending ? '  [pending only]'
    : '';

  const header = [
    '═══════════════════════════════════════════════════════════════════════',
    ' EPIC PRIORITY REPORT',
    ` Algorithm : impact(user×0.50 + quality×0.30 + extend×0.20) − complexity^1.5×0.30`,
    ` Epics shown : ${limited.length} of ${ranked.length}${filterLabel}`,
    '═══════════════════════════════════════════════════════════════════════',
    '',
  ].join('\n');

  process.stdout.write(header);

  limited.forEach(({ epic, priority }, i) => {
    process.stdout.write(formatEpic(i + 1, epic, priority, args.withContext));
    process.stdout.write('\n\n');
  });

  process.stdout.write(
    `═══════════════════════════════════════════════════════════════════════\n`
  );
}

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('epics.mjs') || process.argv[1].endsWith('epics'));

if (isMain) {
  main();
}

export { score, loadEpics, parseArgs, bar, findEpic, searchEpics, setEpicStatus, setEpicField, mutateEpicRef, addEpic, toKebabId, parseReference, readFileReference, extractContext };

// Legacy export alias — extractContext kept for backwards compat
function extractContext(location, lineNum) {
  return readFileReference(parseReference(`${location}:${lineNum}`));
}
