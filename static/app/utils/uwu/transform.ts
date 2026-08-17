const UWU_MAP: Array<[RegExp, string]> = [
  [/(?:r|l)/g, 'w'],
  [/(?:R|L)/g, 'W'],
  [/n([aeiou])/g, 'ny$1'],
  [/N([aeiou])/g, 'Ny$1'],
  [/N([AEIOU])/g, 'Ny$1'],
  [/ove/g, 'uv'],
];

/**
 * sprintf tokens have to survive the transform byte-for-byte. `%(orgSlug)s`
 * would otherwise become `%(owgSwug)s` and silently fail its argument lookup.
 */
const SPRINTF_TOKEN =
  /%(?:%|(?:\d+\$)?(?:\(\w+\))?[-+ 0#']*\d*(?:\.\d+)?[b-gEGijos-vTxX])/g;

/**
 * `tct` group markers, in both the `[link:text]` and bare `[link]` forms. Only
 * the marker is protected — the text inside a group still gets transformed.
 */
const TEMPLATE_GROUP = /\[[a-zA-Z][a-zA-Z0-9]*(?::|\])/g;

const PROTECTED_TOKEN = new RegExp(
  `${SPRINTF_TOKEN.source}|${TEMPLATE_GROUP.source}`,
  'g'
);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const BARE_SCHEME = /^(?:mailto|tel):/i;

/**
 * Words that carry meaning a reader has to be able to retype or click. Note this
 * deliberately does not treat every colon-terminated word as a URL — labels like
 * "IP Addresses:" are prose and should be transformed.
 */
function isUntouchableWord(word: string): boolean {
  return (
    word.startsWith('@') ||
    URL_SCHEME.test(word) ||
    BARE_SCHEME.test(word) ||
    EMAIL.test(word)
  );
}

function uwuifyWord(word: string): string {
  return UWU_MAP.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    word
  );
}

function uwuifyProse(text: string): string {
  return text.replace(/\S+/g, word =>
    isUntouchableWord(word) ? word : uwuifyWord(word)
  );
}

/**
 * Must stay stable: a given input always maps to the same output. Every rule is
 * an unconditional replacement, so nothing here may consult a random source.
 */
export function uwuify(text: string): string {
  const segments: string[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PROTECTED_TOKEN)) {
    segments.push(uwuifyProse(text.slice(cursor, match.index)), match[0]);
    cursor = match.index + match[0].length;
  }

  segments.push(uwuifyProse(text.slice(cursor)));

  return segments.join('');
}

export function getSprintfTokens(text: string): string[] {
  return Array.from(text.matchAll(SPRINTF_TOKEN), match => match[0]);
}

export function getTemplateGroups(text: string): string[] {
  return Array.from(text.matchAll(/\[([a-zA-Z][a-zA-Z0-9]*)[:\]]/g), match => match[1]!);
}
