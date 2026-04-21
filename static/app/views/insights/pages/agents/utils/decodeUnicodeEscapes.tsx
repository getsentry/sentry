/**
 * Decodes literal `\uXXXX` escape sequences that appear in span attribute
 * strings. These occur when AI SDK payloads are double-encoded before storage.
 */
export function decodeUnicodeEscapes(text: string): string {
  return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}
