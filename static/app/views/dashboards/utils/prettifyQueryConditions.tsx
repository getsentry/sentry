import {NAMESPACE_SYMBOL} from 'sentry/actionCreators/savedSearches';

// The marked value is either a `[a,b]` list, a quoted term (which may contain spaces),
// or a bare term running up to the next space.
const OPERATOR_WITH_VALUE_PATTERN = new RegExp(
  `${NAMESPACE_SYMBOL}(\\w+)${NAMESPACE_SYMBOL}(\\[[^\\]]*\\]|"(?:[^"\\\\]|\\\\.)*"|[^\\s]*)`,
  'g'
);

type AddWildcards = (term: string) => string;

/**
 * Split the inner text of a list value on the commas that separate its items.
 * Values containing commas are quoted, so commas inside quotes are kept.
 */
function splitListItems(items: string): string[] {
  const split: string[] = [];
  let item = '';
  let quoted = false;

  for (let i = 0; i < items.length; i++) {
    const character = items[i]!;

    if (character === '"' && items[i - 1] !== '\\') {
      quoted = !quoted;
    }

    if (character === ',' && !quoted) {
      split.push(item);
      item = '';
      continue;
    }

    item += character;
  }
  split.push(item);

  return split;
}

/** Wildcards are part of the term, so they belong inside a quoted value. */
function addWildcardsToTerm(term: string, addWildcards: AddWildcards): string {
  if (term.length >= 2 && term.startsWith('"') && term.endsWith('"')) {
    return `"${addWildcards(term.slice(1, -1))}"`;
  }

  return addWildcards(term);
}

function addWildcardsToValue(value: string, addWildcards: AddWildcards): string {
  if (!value.startsWith('[') || !value.endsWith(']')) {
    return addWildcardsToTerm(value, addWildcards);
  }

  const items = value.slice(1, -1);
  if (!items) {
    return value;
  }

  // A list matches any of its items, so each item gets its own wildcards.
  return `[${splitListItems(items)
    .map(item => addWildcardsToTerm(item, addWildcards))
    .join(',')}]`;
}

/**
 * Converts internal wildcard operator markers in a conditions string back to
 * their user-facing wildcard syntax. The search syntax uses
 * {@link NAMESPACE_SYMBOL} around operator names like "Contains" and
 * "StartsWith".
 *
 * - `Contains` / `DoesNotContain` → `*value*`
 * - `StartsWith` / `DoesNotStartWith` → `value*`
 * - `EndsWith` / `DoesNotEndWith` → `*value`
 *
 * List values wildcard each item rather than the list itself, e.g.
 * `span.op:[db,http]` with `Contains` → `span.op:[*db*,*http*]`.
 *
 * Negation is expressed via `!` on the key (e.g., `!transaction:*value*`),
 * not in the operator marker, so the `DoesNot*` variants produce the same
 * wildcards as their positive counterparts.
 */
export function prettifyQueryConditions(
  conditions: string | undefined
): string | undefined {
  if (!conditions) {
    return undefined;
  }
  return conditions.replace(
    OPERATOR_WITH_VALUE_PATTERN,
    (_match, operator: string, value: string) => {
      switch (operator) {
        case 'Contains':
        case 'DoesNotContain':
          return addWildcardsToValue(value, term => `*${term}*`);
        case 'StartsWith':
        case 'DoesNotStartWith':
          return addWildcardsToValue(value, term => `${term}*`);
        case 'EndsWith':
        case 'DoesNotEndWith':
          return addWildcardsToValue(value, term => `*${term}`);
        default:
          return value;
      }
    }
  );
}
