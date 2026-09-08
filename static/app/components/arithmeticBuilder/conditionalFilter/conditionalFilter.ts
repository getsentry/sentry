import {escapeDoubleQuotes} from 'sentry/utils';

/**
 * EAP `_if` filter args are backtick-wrapped (`avg_if(\`span.op:db\`,…)`). Detect them
 * by parameter name so the editor can show the raw query and re-wrap on commit.
 */
export function isSearchFilterParameter(
  parameter: {kind?: string; name?: string} | null | undefined
): boolean {
  return parameter?.kind === 'value' && parameter.name === 'filter';
}

/**
 * Remove backticks so the filter can be safely wrapped in them.
 */
export function escapeConditionalFilter(filter: string): string {
  return filter.replace(/`/g, '').trim();
}

/**
 * Wrap a search filter for use as the first argument of an EAP `_if` aggregate.
 * Empty input becomes empty backticks so the arithmetic tokenizer keeps a filter slot.
 */
export function ensureSearchFilterArgument(value: string): string {
  const escaped = escapeConditionalFilter(value);
  return `\`${escaped}\``;
}

/**
 * Strip outer backticks from an `_if` filter argument for display / editing.
 */
export function unwrapSearchFilterArgument(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const NEEDS_QUOTING_RE = /[\s(),\\"]/;
/** Search syntax for multi-value filters, e.g. `key:[value1, value2]`. */
const BRACKETED_LIST_VALUE_RE = /^\[[^\]]*\]$/;

/**
 * Quote a tag value when it contains spaces or other special search characters.
 */
function formatConditionalFilterTagValue(value: string): string {
  if (value === '') {
    return '""';
  }
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    BRACKETED_LIST_VALUE_RE.test(value)
  ) {
    return value;
  }
  if (NEEDS_QUOTING_RE.test(value)) {
    return `"${escapeDoubleQuotes(value)}"`;
  }
  return value;
}

export function formatConditionalFilterClause(
  filterKey: string,
  tagValue: string
): string {
  return `${filterKey}:${formatConditionalFilterTagValue(tagValue)}`;
}

type BooleanOperatorMatch = {
  end: number;
  start: number;
};

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function hasUnclosedQuote(value: string): boolean {
  let inQuotes = false;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '\\' && i + 1 < value.length) {
      i++;
      continue;
    }
    if (value[i] === '"' && !isEscaped(value, i)) {
      inQuotes = !inQuotes;
    }
  }
  return inQuotes;
}

function stripQuotesForValueSearch(value: string): string {
  if (value.startsWith('"')) {
    const withoutOpen = value.slice(1);
    if (!hasUnclosedQuote(value) && withoutOpen.endsWith('"')) {
      return withoutOpen.slice(0, -1);
    }
    return withoutOpen;
  }
  return value;
}

function findBooleanOperators(value: string): BooleanOperatorMatch[] {
  const matches: BooleanOperatorMatch[] = [];
  let inQuotes = false;
  let index = 0;

  while (index < value.length) {
    const char = value[index]!;

    if (char === '\\' && index + 1 < value.length) {
      index += 2;
      continue;
    }

    if (char === '"' && !isEscaped(value, index)) {
      inQuotes = !inQuotes;
      index++;
      continue;
    }

    if (!inQuotes) {
      const rest = value.slice(index);
      const match = rest.match(/^(\s+)(and|or)(\s+)/i);
      if (match) {
        matches.push({
          start: index,
          end: index + match[0].length,
        });
        index += match[0].length;
        continue;
      }
    }

    index++;
  }

  return matches;
}

function getConditionalFilterClauseBounds(
  value: string,
  cursorIndex: number,
  booleanOperators: BooleanOperatorMatch[] = findBooleanOperators(value)
): {clauseEnd: number; clauseStart: number} {
  let cursor = Math.max(0, Math.min(cursorIndex, value.length));

  // Cursor on a boolean operator counts as the start of the following clause.
  for (const operator of booleanOperators) {
    if (cursor >= operator.start && cursor <= operator.end) {
      cursor = operator.end;
      break;
    }
  }

  let clauseStart = 0;
  let clauseEnd = value.length;

  for (const operator of booleanOperators) {
    if (cursor >= operator.end) {
      clauseStart = operator.end;
      continue;
    }

    if (cursor < operator.start) {
      clauseEnd = operator.start;
      break;
    }
  }

  return {clauseStart, clauseEnd};
}

function getConditionalFilterClauseAtCursor(
  value: string,
  cursorIndex: number
): {
  clause: string;
  clauseCursorIndex: number;
  clauseEnd: number;
  clauseStart: number;
} {
  const {clauseStart, clauseEnd} = getConditionalFilterClauseBounds(value, cursorIndex);
  const clause = value.slice(clauseStart, clauseEnd);
  return {
    clause,
    clauseStart,
    clauseEnd,
    clauseCursorIndex: Math.max(0, Math.min(cursorIndex, value.length) - clauseStart),
  };
}

export type ConditionalFilterEditContext = {
  /** Text used to filter key suggestions or ComboBox input matching. */
  editText: string;
  phase: 'key' | 'value';
  replaceEnd: number;
  replaceStart: number;
  filterKey?: string;
  /** Tag-value API search string (quotes stripped). */
  valueQuery?: string;
};

/**
 * Grouping `(` / `)` around a clause (e.g. `(span.op:db)`) must not be treated as part
 * of the filter key or value, or autocomplete filters itself to nothing after `(`.
 */
function getClauseInnerBounds(clause: string): {innerEnd: number; innerStart: number} {
  let innerStart = 0;
  let innerEnd = clause.length;

  while (innerStart < innerEnd && clause[innerStart] === '(') {
    innerStart++;
    while (innerStart < innerEnd && clause[innerStart] === ' ') {
      innerStart++;
    }
  }

  const innerSoFar = clause.slice(innerStart, innerEnd);
  if (!hasUnclosedQuote(innerSoFar)) {
    while (innerEnd > innerStart && clause[innerEnd - 1] === ')') {
      innerEnd--;
      while (innerEnd > innerStart && clause[innerEnd - 1] === ' ') {
        innerEnd--;
      }
    }
  }

  return {innerStart, innerEnd};
}

/**
 * Decide whether the cursor is editing a filter key or value, and which substring
 * a suggestion should replace.
 *
 * Value mode continues while the value is still open:
 * - empty value after `:`
 * - unquoted value with no trailing whitespace yet
 * - quoted value with an unclosed `"`
 *
 * Once a value is complete (`key:value `, or `key:"quoted"`), subsequent text is a
 * new key and key autocomplete is shown.
 *
 * Leading/trailing grouping parentheses are preserved outside the replace range so
 * suggestions still work inside `(...)`.
 */
export function getConditionalFilterEditContext(
  value: string,
  cursorIndex: number
): ConditionalFilterEditContext {
  const {clause, clauseStart, clauseCursorIndex} = getConditionalFilterClauseAtCursor(
    value,
    cursorIndex
  );

  const {innerStart, innerEnd} = getClauseInnerBounds(clause);
  const inner = clause.slice(innerStart, innerEnd);
  const innerCursorIndex = Math.max(
    0,
    Math.min(clauseCursorIndex, clause.length) - innerStart
  );
  const clampedInnerCursor = Math.max(0, Math.min(innerCursorIndex, inner.length));
  const absoluteInnerStart = clauseStart + innerStart;
  // Keep trailing grouping `)` outside replacements; leading `(` stay before replaceStart.
  const absoluteInnerEnd = clauseStart + innerEnd;

  const colonIndex = inner.indexOf(':');
  if (colonIndex === -1 || clampedInnerCursor <= colonIndex) {
    return {
      phase: 'key',
      editText: inner.slice(0, clampedInnerCursor).trim(),
      replaceStart: absoluteInnerStart,
      replaceEnd: absoluteInnerEnd,
    };
  }

  const filterKey = inner.slice(0, colonIndex).trim();
  const valuePart = inner.slice(colonIndex + 1);
  const cursorInValue = Math.max(0, clampedInnerCursor - (colonIndex + 1));
  const beforeCursor = valuePart.slice(0, cursorInValue);

  // Unclosed quotes → keep editing the value (including spaces inside the quote).
  if (hasUnclosedQuote(beforeCursor)) {
    return {
      phase: 'value',
      editText: beforeCursor,
      filterKey,
      valueQuery: stripQuotesForValueSearch(beforeCursor),
      replaceStart: absoluteInnerStart,
      replaceEnd: absoluteInnerEnd,
    };
  }

  // Closed quoted value: `"hello there"` or `"hello there" nextKey`
  if (beforeCursor.startsWith('"')) {
    const closedQuoteMatch = beforeCursor.match(/^"(?:[^"\\]|\\.)*"(\s*)(.*)$/);
    if (closedQuoteMatch) {
      const [, spaces = '', nextKey = ''] = closedQuoteMatch;
      const quotedValue = beforeCursor.slice(
        0,
        beforeCursor.length - spaces.length - nextKey.length
      );
      const keyStartInInner = colonIndex + 1 + quotedValue.length + spaces.length;
      return {
        phase: 'key',
        editText: nextKey,
        replaceStart: absoluteInnerStart + keyStartInInner,
        replaceEnd: absoluteInnerEnd,
      };
    }
  }

  // Unquoted value: complete once whitespace follows a non-empty token.
  const unquotedMatch = beforeCursor.match(/^(\S+)(\s+)(.*)$/);
  if (unquotedMatch) {
    const [, completedValue, spaces, nextKey = ''] = unquotedMatch;
    const keyStartInInner = colonIndex + 1 + completedValue!.length + spaces!.length;
    return {
      phase: 'key',
      editText: nextKey,
      replaceStart: absoluteInnerStart + keyStartInInner,
      replaceEnd: absoluteInnerEnd,
    };
  }

  // Still typing an unquoted value (or empty value after `:`).
  return {
    phase: 'value',
    editText: beforeCursor,
    filterKey,
    valueQuery: beforeCursor,
    replaceStart: absoluteInnerStart,
    replaceEnd: absoluteInnerEnd,
  };
}

export function replaceConditionalFilterClause(
  value: string,
  cursorIndex: number,
  newClause: string
): {newCursorIndex: number; newValue: string} {
  const {replaceStart, replaceEnd} = getConditionalFilterEditContext(value, cursorIndex);
  const newValue = value.slice(0, replaceStart) + newClause + value.slice(replaceEnd);
  const newCursorIndex = replaceStart + newClause.length;
  return {newValue, newCursorIndex};
}

export function isFilterKeySuggestion(value: string): boolean {
  return value.endsWith(':') && value.indexOf(':') === value.length - 1;
}
