/**
 * Does not throw error on invalid input and returns the parsed URL object
 * if the input is a valid URL, otherwise returns undefined.
 */
export function safeURL(input: string | URL, base?: string | undefined): URL | undefined {
  try {
    return new globalThis.URL(input, base);
  } catch {
    return undefined;
  }
}
