/**
 * Does not throw error on invalid input and returns the parsed URL object
 * if the input is a valid URL, otherwise returns undefined.
 * @param {string} input
 * @param {string | undefined} base
 * @returns {URL | undefined}
 */
export function safeURL(input: string | URL, base?: string | undefined): URL | undefined {
  try {
    return new globalThis.URL(input, base);
  } catch {
    return undefined;
  }
}
