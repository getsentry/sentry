import type {Random} from './seed';
import {pick} from './seed';
import {isUntouchableWord, LETTER, WORD} from './words';

/**
 * Deliberately no "actions" category. The genre's stock actions are not things
 * that should ever render in a work tool, even behind a flag.
 */
export const FACES = ['UwU', 'OwO', '>w<', '^-^', ':3', 'uwu'] as const;

export const EXCLAMATIONS = ['!!11', '?!?1', '!?', '?!!'] as const;

/**
 * Replacements applied instead of the phoneme rules, so they are written in
 * their already-transformed form — running `l -> w` over "smol" would undo it.
 */
const LEXICON = new Map([
  ['small', 'smol'],
  ['please', 'pwease'],
  ['friend', 'fwiend'],
  ['friends', 'fwiends'],
  ['the', 'da'],
  ['you', 'yew'],
  ['cute', 'kawaii'],
  ['what', 'wat'],
  ['love', 'wuv'],
  ['very', 'vewy'],
  ['really', 'vewwy'],
  ['have', 'haz'],
]);

const STUTTER_CHANCE = 0.35;
const FACE_CHANCE = 0.25;

const TRAILING_EXCLAMATION = /[?!]+$/;

function matchCase(source: string, replacement: string): string {
  if (source[0] !== source[0]?.toUpperCase()) {
    return replacement;
  }

  return replacement[0]!.toUpperCase() + replacement.slice(1);
}

/**
 * Applied per word so that trailing punctuation and capitalisation survive.
 */
export function applyLexicon(word: string): string | null {
  const parts = WORD.exec(word);

  if (!parts) {
    return null;
  }

  const [, leading, core, trailing] = parts;
  const replacement = LEXICON.get(core!.toLowerCase());

  if (!replacement) {
    return null;
  }

  return leading! + matchCase(core!, replacement) + trailing;
}

/**
 * A stutter duplicates the first character of the word, so a word starting with
 * a digit would come out as "2-2FA" — corruption rather than a joke.
 */
function canStutter(word: string): boolean {
  const parts = WORD.exec(word);

  return parts !== null && LETTER.test(parts[2]![0]!);
}

function stutter(word: string): string {
  const parts = WORD.exec(word);

  if (!parts) {
    return word;
  }

  const [, leading, core, trailing] = parts;

  return `${leading}${core![0]}-${core}${trailing}`;
}

/**
 * Spends at most one embellishment on the phrase. Per-word coin flips gave a
 * long tail of strings carrying three or more, and tied a given flourish to a
 * given word everywhere it appeared; a single phrase-level budget removes both.
 */
export function embellish(text: string, random: Random): string {
  if (TRAILING_EXCLAMATION.test(text)) {
    return text.replace(TRAILING_EXCLAMATION, pick(random, EXCLAMATIONS));
  }

  const roll = random();
  const words = text.split(' ');
  const eligible = words.reduce<number[]>(
    (indexes, word, index) =>
      isUntouchableWord(word) || !canStutter(word) ? indexes : [...indexes, index],
    []
  );

  if (roll < STUTTER_CHANCE && eligible.length > 2) {
    const index = pick(random, eligible);
    words[index] = stutter(words[index]!);
    return words.join(' ');
  }

  if (roll < STUTTER_CHANCE + FACE_CHANCE) {
    return `${text} ${pick(random, FACES)}`;
  }

  return text;
}
