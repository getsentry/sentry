// Inverts the "humanized" filter rendering (e.g. "is unresolved assigned is me") back to ESQ ("is:unresolved assigned:me").
// It is the reverse of `formatToken` / `formatQueryToNaturalLanguage`. Returns null when nothing inverts, to fall back on AI.

// Humanized comparator phrase -> ESQ operator (inverse of formatToken's table). Longest first.
const COMPARATORS: ReadonlyArray<{op: string; phrase: string[]}> = [
  {phrase: ['greater', 'than', 'or', 'equal', 'to'], op: '>='},
  {phrase: ['less', 'than', 'or', 'equal', 'to'], op: '<='},
  {phrase: ['greater', 'than'], op: '>'},
  {phrase: ['less', 'than'], op: '<'},
];

const BOOLEAN_OPS = new Set(['and', 'or']);

// Split on whitespace but keep quoted strings ("a b") intact, same as formatQueryToNaturalLanguage.
function tokenize(input: string): string[] {
  return input.match(/(?:[^\s"]|"[^"]*")+/g) ?? [];
}

// Reads an optional "not" at `start`; `next` points past it.
function readNegation(words: string[], start: number): {negated: boolean; next: number} {
  const negated = words[start]?.toLowerCase() === 'not';
  return {negated, next: negated ? start + 1 : start};
}

// Reads an optional comparator phrase at `start`; `op` is "" for plain equality.
function readComparator(words: string[], start: number): {next: number; op: string} {
  for (const {phrase, op} of COMPARATORS) {
    if (phrase.every((part, k) => words[start + k]?.toLowerCase() === part)) {
      return {op, next: start + phrase.length};
    }
  }
  return {op: '', next: start};
}

// The value token at `index`, minus any trailing comma left by the ", " filter separator.
function valueAt(words: string[], index: number): string | undefined {
  const token = words[index];
  if (token === undefined) {
    return undefined;
  }
  return token.endsWith(',') ? token.slice(0, -1) : token;
}

export function humanizedToEsq(
  input: string,
  isFilterKey: (key: string) => boolean
): string | null {
  const words = tokenize(input.trim());
  const esq: string[] = [];
  let hasFilter = false;
  // `is` reads as the status key only at the start of a clause; trailing prose
  // ("the build is broken") is the English copula, so leave it alone.
  let atClauseStart = true;
  let i = 0;

  while (i < words.length) {
    const word = words[i]!;
    const lower = word.toLowerCase();

    // AND / OR
    if (BOOLEAN_OPS.has(lower)) {
      esq.push(lower.toUpperCase());
      atClauseStart = true;
      i++;
      continue;
    }

    // "is [not] <status>" -> [!]is:<status>  (the `is` key renders with no separator)
    if (lower === 'is' && atClauseStart && isFilterKey('is')) {
      const {negated, next} = readNegation(words, i + 1);
      const status = valueAt(words, next)?.toLowerCase();
      if (status !== undefined) {
        esq.push(`${negated ? '!' : ''}is:${status}`);
        hasFilter = true;
        atClauseStart = true;
        i = next + 1;
        continue;
      }
    }

    // "<key> is [not] [comparator] <value>" -> [!]key:[op]value
    if (words[i + 1]?.toLowerCase() === 'is' && isFilterKey(word)) {
      const {negated, next} = readNegation(words, i + 2);
      const {op, next: valueIndex} = readComparator(words, next);
      const value = valueAt(words, valueIndex);
      if (value !== undefined) {
        esq.push(`${negated ? '!' : ''}${word}:${op}${value}`);
        hasFilter = true;
        atClauseStart = true;
        i = valueIndex + 1;
        continue;
      }
    }

    // free text
    esq.push(word);
    atClauseStart = false;
    i++;
  }

  return hasFilter ? esq.join(' ') : null;
}
