/** A valid bearer credential contains only visible ASCII bytes. */
const INVALID_TOKEN_CHARACTER_PATTERN = /[^\x21-\x7e]/;
// oxlint-disable-next-line no-control-regex -- copied ASCII controls are removable edge padding.
const TOKEN_PADDING_PATTERN = /[\s\x00-\x1f\x7f]/;

/** Strip padding at the edges without changing bytes within the token. */
export function trimAuthToken(token: string): string {
  let start = 0;
  let end = token.length;
  while (start < end && TOKEN_PADDING_PATTERN.test(token.charAt(start))) {
    start += 1;
  }
  while (end > start && TOKEN_PADDING_PATTERN.test(token.charAt(end - 1))) {
    end -= 1;
  }
  return token.slice(start, end);
}

/** Return null for invalid input so each caller can preserve its own error type. */
export function normalizeAuthToken(token: string): string | null {
  const normalized = trimAuthToken(token);
  return normalized && !INVALID_TOKEN_CHARACTER_PATTERN.test(normalized)
    ? normalized
    : null;
}

/** Format a validated upstream credential; callers own their auth errors. */
export function sentryBearerHeader(token: string): string | null {
  const normalized = normalizeAuthToken(token);
  return normalized === null ? null : `Bearer ${normalized}`;
}
