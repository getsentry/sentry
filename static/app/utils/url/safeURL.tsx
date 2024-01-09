/**
 * Does not throw error on invalid input and returns the parsed URL object
 * if the input is a valid URL, otherwise returns undefined.
 * @param {string} input
 * @param {string | undefined} base
 * @returns {URL | undefined}
 */
export function safeURL(input: string | URL, base?: string | undefined): URL | undefined {
  if ('canParse' in globalThis.URL) {
    if (globalThis.URL.canParse(input, base)) {
      return new URL(input, base);
    }
    return undefined;
  }

  try {
    // @ts-expect-error ts narrows URL constructor to
    // never because it does not know that canParse may not be
    // implemented on the globalThis.URL object
    return new globalThis.URL(input, base);
  } catch {
    return undefined;
  }
}
