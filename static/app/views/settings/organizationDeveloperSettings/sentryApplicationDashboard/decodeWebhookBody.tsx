/**
 * Bodies written before #122361 were double-encoded
 *
 * TODO(integrations): Remove this compatibility shim after 2026-09-24, when entries
 * written before #122361 have expired, and use jsonrepair for truncated JSON.
 */
export interface DecodedWebhookBody {
  maybeTruncated: boolean;
  parsed: unknown;
  raw: string;
}

function reachedSizeCap(body: string) {
  return body.length >= 1024; // See: src/sentry/utils/sentry_apps/request_buffer.py
}

/**
 * Renders `"{\"action\": \"assig` as `{"action": "assig` rather than as its own
 * escaped source.
 */
function unwrapTruncatedString(text: string): string | null {
  if (!text.startsWith('"')) {
    return null;
  }

  const candidates = [text];

  // A cut inside `\"` or `\uXXXX` leaves an escape the parser cannot close.
  const partialEscape = text.match(/\\(?:u[0-9a-fA-F]{0,3})?$/);
  if (partialEscape) {
    candidates.push(text.slice(0, partialEscape.index));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(`${candidate}"`);
    } catch {
      continue;
    }
  }

  return null;
}

export function decodeWebhookBody(body: string): DecodedWebhookBody {
  let value: unknown;

  try {
    value = JSON.parse(body);
  } catch {
    // Only a body that lost its closing quote can be recovered by adding one.
    const unwrapped = unwrapTruncatedString(body);
    if (unwrapped !== null) {
      return {parsed: null, raw: unwrapped, maybeTruncated: true};
    }
    return {parsed: null, raw: body, maybeTruncated: reachedSizeCap(body)};
  }

  if (typeof value === 'string') {
    const inner = value;
    try {
      value = JSON.parse(inner);
    } catch {
      return {parsed: null, raw: inner, maybeTruncated: reachedSizeCap(body)};
    }
  }

  if (typeof value === 'object' && value !== null) {
    return {parsed: value, raw: body, maybeTruncated: false};
  }

  return {parsed: null, raw: String(value), maybeTruncated: false};
}
