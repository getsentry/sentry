import {applyLexicon, embellish} from './embellish';
import type {Random} from './seed';
import {createRandom} from './seed';
import {isUntouchableWord, LETTER} from './words';

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

function uwuifyWord(word: string): string {
  if (isUntouchableWord(word)) {
    return word;
  }

  return (
    applyLexicon(word) ??
    UWU_MAP.reduce(
      (result, [pattern, replacement]) => result.replace(pattern, replacement),
      word
    )
  );
}

function uwuifyProse(text: string): string {
  return text.replace(/\S+/g, uwuifyWord);
}

/**
 * Carries no randomness at all, so every caller gets the same answer for a given
 * string without needing a seed.
 */
export function uwuifyPhonemes(text: string): string {
  const segments: string[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PROTECTED_TOKEN)) {
    segments.push(uwuifyProse(text.slice(cursor, match.index)), match[0]);
    cursor = match.index + match[0].length;
  }

  segments.push(uwuifyProse(text.slice(cursor)));

  return segments.join('');
}

function protectedTokens(text: string): string {
  return JSON.stringify(Array.from(text.matchAll(PROTECTED_TOKEN), match => match[0]));
}

/**
 * An embellishment can create a token as well as damage one: appending a face to
 * "100%" yields "100% uwu", whose "% u" reads as a sprintf token that the source
 * string never had. Rather than special-casing each adjacency, drop any
 * embellishment that changes the token list at all.
 */
function embellishSafely(text: string, random: Random): string {
  const embellished = embellish(text, random);

  return protectedTokens(embellished) === protectedTokens(text) ? embellished : text;
}

/**
 * Whether anything outside the placeholders is actually prose. "%s" has a letter
 * in it, but not one a flourish can attach to.
 */
function hasProse(text: string): boolean {
  return LETTER.test(text.replace(PROTECTED_TOKEN, ''));
}

/**
 * Seeded on the msgid rather than on the rendered fragment, so a given UI string
 * looks the same everywhere it appears and `t` and `tct` agree on it.
 */
export function uwuify(text: string, seed: string = text): string {
  const phonetic = uwuifyPhonemes(text);

  return hasProse(phonetic) ? embellishSafely(phonetic, createRandom(seed)) : phonetic;
}

/**
 * `tct` arrives as a list of text leaves rather than one string. They share a
 * single budget, spent on the last non-empty leaf so the flourish still lands at
 * the end of the rendered sentence.
 */
export function uwuifyLeaves(leaves: string[], seed: string): string[] {
  const random = createRandom(seed);
  const transformed = leaves.map(uwuifyPhonemes);

  for (let index = transformed.length - 1; index >= 0; index--) {
    if (hasProse(transformed[index]!)) {
      transformed[index] = embellishSafely(transformed[index]!, random);
      break;
    }
  }

  return transformed;
}

export function getSprintfTokens(text: string): string[] {
  return Array.from(text.matchAll(SPRINTF_TOKEN), match => match[0]);
}

export function getTemplateGroups(text: string): string[] {
  return Array.from(text.matchAll(/\[([a-zA-Z][a-zA-Z0-9]*)[:\]]/g), match => match[1]!);
}
