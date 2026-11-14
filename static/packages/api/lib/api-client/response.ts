/**
 * Reading Sentry API responses. Hosts map what these return to their own
 * errors: the MCP to `ApiError` subclasses, the CLI to its exit-coded ones.
 */

import { parseRetryDelayMs } from "./retry.js";

/** What a failed response's body says, read once. */
export type ErrorResponseBody = {
  /** The raw body, or undefined when it could not be read. */
  text: string | undefined;
  /** The parsed body, when it is JSON. */
  json?: unknown;
  /** Why the body is not JSON, when it is not. */
  parseError?: string;
  /** The server's `detail` message, when the JSON body has a string one. */
  detail?: string;
  /** True when the body is an HTML page, usually from a proxy or a wrong URL. */
  isHtml: boolean;
  /** Server-requested wait before retrying, from the rate-limit headers. */
  retryAfterMs?: number;
  /**
   * Scopes the endpoint accepts, from a 403's `insufficient_scope` challenge;
   * see {@link parseInsufficientScopeChallenge}. Unset for other responses.
   */
  acceptedScopes?: string[];
};

const INSUFFICIENT_SCOPE_ERROR_RE = /\berror="insufficient_scope"/i;
const CHALLENGE_SCOPE_RE = /\bscope="([^"]*)"/i;
const SCOPE_NAME_RE = /^[a-z_]+:[a-z_]+$/i;

/**
 * Read the scopes from an RFC 6750 `insufficient_scope` challenge.
 *
 * Sentry answers a token that lacks every scope an endpoint accepts with a
 * 403, DRF's generic `detail`, and
 * `WWW-Authenticate: Bearer error="insufficient_scope", scope="..."`
 * (getsentry/sentry#118612). The header lists each scope the endpoint
 * accepts, and any one of them is enough. Other 403s, such as a token for
 * another organization, come without it.
 *
 * @param header - The `WWW-Authenticate` response header
 * @returns The accepted scopes in the server's order. Empty when the header
 *   is missing or is not an `insufficient_scope` challenge.
 */
export function parseInsufficientScopeChallenge(
  header: string | null | undefined,
): string[] {
  if (!(header && INSUFFICIENT_SCOPE_ERROR_RE.test(header))) {
    return [];
  }
  const scopes = header.match(CHALLENGE_SCOPE_RE)?.[1] ?? "";
  return [
    ...new Set(
      scopes.split(/\s+/).filter((scope) => SCOPE_NAME_RE.test(scope)),
    ),
  ];
}

/** The scopes a 403's challenge names, or undefined for none. */
function readAcceptedScopes(response: Response): string[] | undefined {
  if (response.status !== 403) {
    return undefined;
  }
  const scopes = parseInsufficientScopeChallenge(
    response.headers.get("www-authenticate"),
  );
  return scopes.length > 0 ? scopes : undefined;
}

function readDetail(json: unknown): string | undefined {
  if (json === null || typeof json !== "object" || !("detail" in json)) {
    return undefined;
  }
  return typeof json.detail === "string" ? json.detail : undefined;
}

function looksLikeHtml(text: string): boolean {
  return text.includes("<!DOCTYPE") || text.includes("<html");
}

/** Read the body of a failed response, consuming it. */
export async function readErrorResponse(
  response: Response,
): Promise<ErrorResponseBody> {
  const retryAfterMs = parseRetryDelayMs(response.status, response.headers);
  const acceptedScopes = readAcceptedScopes(response);
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { text: undefined, isHtml: false, retryAfterMs, acceptedScopes };
  }
  try {
    const json: unknown = JSON.parse(text);
    return {
      text,
      json,
      detail: readDetail(json),
      isHtml: false,
      retryAfterMs,
      acceptedScopes,
    };
  } catch (error) {
    return {
      text,
      parseError: error instanceof Error ? error.message : String(error),
      isHtml: looksLikeHtml(text),
      retryAfterMs,
      acceptedScopes,
    };
  }
}

/**
 * Parse a successful response as JSON, checking its Content-Type first.
 *
 * @throws {Error} When the body is HTML, another content type, or malformed
 */
export async function readJsonResponse(response: Response): Promise<unknown> {
  // Test doubles and some promise chains pass responses without headers.
  if (!response.headers?.get) {
    return await response.json();
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const text = await response.text();
    if (contentType?.includes("text/html") || looksLikeHtml(text)) {
      // HTML in place of JSON usually means auth or routing went wrong.
      throw new Error(
        `Expected JSON response but received HTML (${response.status} ${response.statusText}). This may indicate you're not authenticated, the URL is incorrect, or there's a server issue.`,
      );
    }
    throw new Error(
      `Expected JSON response but received ${contentType || "unknown content type"} ` +
        `(${response.status} ${response.statusText})`,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
