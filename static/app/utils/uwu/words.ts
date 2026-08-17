const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const BARE_SCHEME = /^(?:mailto|tel):/i;

/**
 * Carries a sprintf token or a `tct` group marker, so neither the phoneme rules
 * nor a stutter may touch it.
 */
const PROTECTED = /[%[]/;

export const WORD = /^(\W*)([\w']+)(.*)$/;

/**
 * A flourish on text with no letters in it reads as breakage rather than as a
 * joke: "300" rendering as "300 >w<", or "Defaults to 1" as "Defauwts to 1-1",
 * both look like data bugs.
 */
export const LETTER = /\p{L}/u;

/**
 * Words a reader has to be able to retype or click. Note this deliberately does
 * not treat every colon-terminated word as a URL — labels like "IP Addresses:"
 * are prose and should be transformed.
 */
export function isUntouchableWord(word: string): boolean {
  return (
    word.startsWith('@') ||
    PROTECTED.test(word) ||
    URL_SCHEME.test(word) ||
    BARE_SCHEME.test(word) ||
    EMAIL.test(word)
  );
}
