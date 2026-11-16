/**
 * The request core that endpoint wrappers build on. It sends a request
 * through the host's transport, turns network failures and error responses
 * into the shared errors, and reads JSON bodies. `@sentry/api` operations
 * get a client that sends through the same path, and {@link listPage} walks
 * their pages.
 *
 * The host supplies the transport (retries, caching), the per-request
 * headers (credentials, user agent, attribution), and logging.
 */

import {
  createSentryClient,
  parseSentryLinkHeader,
  type SentryClient,
} from "@sentry/api";
import { API_BASE_PATH, buildSentryApiUrl } from "./api-path.js";
import {
  type ApiError,
  ApiValidationError,
  ConfigurationError,
  createApiError,
} from "./errors.js";
import { API_MAX_PER_PAGE, paginate } from "./pagination.js";
import {
  type ErrorResponseBody,
  readErrorResponse,
  readJsonResponse,
} from "./response.js";
import { type ResponseSchema, validateResponse } from "./validate.js";

/** What the core needs from the host's transport. */
export type ApiRequestTransport = {
  request(url: string, init: RequestInit): Promise<Response>;
};

export type ApiClientLogger = {
  warn(message: string, extra: Record<string, unknown>): void;
};

export type ApiClientCoreOptions = {
  transport: ApiRequestTransport;
  /**
   * Headers for every request after `Content-Type`, such as Authorization
   * and User-Agent. Called once per request; may throw for a bad credential.
   * They replace any headers the caller passes.
   */
  headers: () => Record<string, string>;
  logger: ApiClientLogger;
};

export type ApiRequestOptions = {
  /** Error statuses returned as the response instead of thrown. */
  allowStatuses?: number[];
};

export type ApiClientCore = {
  /**
   * Send a request to `origin` + {@link API_BASE_PATH} + `path`.
   *
   * @throws {ApiError} For an error status not in `allowStatuses`
   * @throws {ConfigurationError} When the host is unreachable or misconfigured
   * @throws {Error} For other network failures, with a readable message
   */
  request(
    origin: string,
    path: string,
    init?: RequestInit,
    options?: ApiRequestOptions,
  ): Promise<Response>;
  /** {@link ApiClientCore.request}, then the parsed JSON body. */
  requestJson(
    origin: string,
    path: string,
    init?: RequestInit,
  ): Promise<unknown>;
  /**
   * A `@sentry/api` client for one GET to `expectedPath` on `origin`. The
   * operation builds the path and query; the request goes through
   * {@link ApiClientCore.request}. Any other target or method throws.
   */
  sdkClient(origin: string, expectedPath: string): SentryClient["client"];
};

/** Where an endpoint wrapper sends: the core, and the region or host origin. */
export type ApiTarget = { core: ApiClientCore; origin: string };

/** Most pages {@link listPage} fetches for one call. */
export const MAX_LIST_PAGES = 50;

/** Rows from {@link listPage}, and the cursor for the next call. */
export type ListPage<T> = { items: T[]; nextCursor: string | null };

/** The cursor of the next page in a list response's `Link` header, if any. */
export function nextPageCursor(response: Response): string | null {
  return parseSentryLinkHeader(response.headers.get("link")).nextCursor ?? null;
}

/** Readable messages for common network error codes. */
const NETWORK_ERROR_MESSAGES: Record<string, string> = {
  EAI_AGAIN: "DNS temporarily unavailable. Check your internet connection.",
  ENOTFOUND: "Hostname not found. Verify the URL is correct.",
  ECONNREFUSED: "Connection refused. Ensure the service is accessible.",
  ETIMEDOUT: "Connection timed out. Check network connectivity.",
  ECONNRESET: "Connection reset. Try again in a moment.",
};

/** Network failures that mean the host is wrong or unreachable. */
const CONFIGURATION_ERROR_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ETIMEDOUT",
]);

/** A failed fetch as a readable error naming the URL. */
function networkError(url: string, error: unknown): Error {
  let rootCause = error;
  while (rootCause instanceof Error && rootCause.cause) {
    rootCause = rootCause.cause;
  }
  const errorMessage =
    rootCause instanceof Error ? rootCause.message : String(rootCause);
  const errorCode = Object.keys(NETWORK_ERROR_MESSAGES).find((code) =>
    errorMessage.includes(code),
  );
  const friendlyMessage = `Unable to connect to ${url} - ${
    errorCode ? NETWORK_ERROR_MESSAGES[errorCode] : errorMessage
  }`;
  if (
    (errorCode && CONFIGURATION_ERROR_CODES.has(errorCode)) ||
    errorMessage.includes("Connect Timeout Error")
  ) {
    return new ConfigurationError(friendlyMessage, { cause: error });
  }
  return new Error(friendlyMessage, { cause: error });
}

/** A failed response's body as the matching `ApiError` subclass. */
function errorFromResponse(
  logger: ApiClientLogger,
  response: Response,
  body: ErrorResponseBody,
  logExtra: Record<string, unknown>,
): ApiError {
  const { retryAfterMs, acceptedScopes } = body;
  const errorText = body.text ?? "";
  const bodyPreview =
    errorText.length > 256 ? `${errorText.slice(0, 253)}…` : errorText;

  if (body.parseError !== undefined) {
    if (body.isHtml) {
      logger.warn("Received HTML error page instead of JSON", {
        ...logExtra,
        parseErrorMessage: body.parseError,
      });
      // An HTML page instead of JSON usually means a wrong URL or a proxy.
      return createApiError(
        `Server error: Received HTML instead of JSON (${response.status} ${response.statusText}). This may indicate an invalid URL or server issue.`,
        response.status,
        errorText,
        undefined,
        retryAfterMs,
        acceptedScopes,
      );
    }
    logger.warn("Failed to parse JSON error response", {
      ...logExtra,
      bodyPreview,
      parseErrorMessage: body.parseError,
    });
  } else if (body.json) {
    if (body.detail !== undefined) {
      return createApiError(
        body.detail,
        response.status,
        body.detail,
        body.json,
        retryAfterMs,
        acceptedScopes,
      );
    }
    logger.warn("Failed to parse validated API error response", {
      ...logExtra,
      bodyPreview,
      validationErrorMessage: "Error response has no string detail",
    });
  }

  return createApiError(
    `API request failed: ${response.statusText}\n${errorText}`,
    response.status,
    errorText,
    undefined,
    retryAfterMs,
    acceptedScopes,
  );
}

export function createApiClientCore({
  transport,
  headers,
  logger,
}: ApiClientCoreOptions): ApiClientCore {
  async function request(
    origin: string,
    path: string,
    init: RequestInit = {},
    { allowStatuses }: ApiRequestOptions = {},
  ): Promise<Response> {
    const url = buildSentryApiUrl(origin, path);
    const requestHeaders = {
      "Content-Type": "application/json",
      ...headers(),
    };

    if (typeof globalThis.fetch === "undefined") {
      throw new ConfigurationError(
        "fetch is not available. Please use Node.js >= 18 or ensure fetch is available in your environment.",
      );
    }

    let response: Response;
    try {
      response = await transport.request(url, {
        ...init,
        headers: requestHeaders,
      });
    } catch (error) {
      // An abort, including one during a retry wait, keeps the caller's reason.
      if (init.signal?.aborted) {
        throw error;
      }
      throw networkError(url, error);
    }

    if (response.ok || allowStatuses?.includes(response.status)) {
      return response;
    }
    throw errorFromResponse(
      logger,
      response,
      await readErrorResponse(response),
      {
        status: response.status,
        statusText: response.statusText,
        host: new URL(origin).host,
        path,
      },
    );
  }

  return {
    request,

    async requestJson(origin, path, init) {
      return await readJsonResponse(await request(origin, path, init));
    },

    sdkClient(origin, expectedPath) {
      const base = new URL(origin).origin;
      const sdkFetch = async (sdkRequest: RequestInfo | URL) => {
        if (!(sdkRequest instanceof Request)) {
          throw new ConfigurationError("Unexpected SDK request input");
        }
        const url = new URL(sdkRequest.url);
        if (
          url.origin !== base ||
          url.pathname !== API_BASE_PATH.concat(expectedPath) ||
          sdkRequest.method !== "GET"
        ) {
          throw new ConfigurationError(
            "Unexpected SDK request target or method",
          );
        }
        const response = await request(
          origin,
          `${url.pathname.slice(API_BASE_PATH.length)}${url.search}`,
          { method: "GET", signal: sdkRequest.signal },
        );
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          await readJsonResponse(response);
        }
        return response;
      };
      // Bun's `typeof fetch` also declares `preconnect`, which the SDK never calls.
      return createSentryClient({ baseUrl: base, fetch: sdkFetch as typeof fetch })
        .client;
    },
  };
}

/**
 * Fetch up to `limit` rows from a list endpoint, starting at `cursor`.
 *
 * Walks pages with {@link paginate}, so every request in a walk uses the same
 * `per_page`: a fresh walk splits `limit` evenly, and a page-number cursor
 * (`OffsetPaginator`) keeps the page size it encodes. Each page is validated
 * with `schema`. The walk stops once it has `limit` rows, the server has no
 * next page, or it has fetched {@link MAX_LIST_PAGES} pages, and returns a
 * cursor that resumes at the first row not returned.
 *
 * @throws {ApiValidationError} When `limit` is not between 1 and
 *   `API_MAX_PER_PAGE * MAX_LIST_PAGES`
 * @throws {ApiResponseValidationError} When a page does not match `schema`
 * @throws {Error} When a page has more rows than requested or a cursor repeats
 */
export async function listPage<T>(
  fetchPage: (
    perPage: number,
    cursor: string | undefined,
  ) => Promise<{ data: unknown; response: Response }>,
  schema: ResponseSchema<T[]>,
  limit: number,
  initialCursor?: string | null,
): Promise<ListPage<T>> {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > API_MAX_PER_PAGE * MAX_LIST_PAGES
  ) {
    throw new ApiValidationError(
      `limit must be an integer between 1 and ${API_MAX_PER_PAGE * MAX_LIST_PAGES}`,
    );
  }
  const seenCursors = new Set<string>();
  const result = await paginate(
    { limit, cursor: initialCursor ?? undefined, maxPages: MAX_LIST_PAGES },
    async (perPage, cursor) => {
      const { data, response } = await fetchPage(perPage, cursor);
      const rows = validateResponse(schema, data);
      if (rows.length > perPage) {
        throw new Error("API returned more items than requested");
      }
      const nextCursor = nextPageCursor(response);
      if (nextCursor) {
        if (seenCursors.has(nextCursor) || nextCursor === cursor) {
          throw new Error("API returned a repeated pagination cursor");
        }
        seenCursors.add(nextCursor);
      }
      return nextCursor ? { data: rows, nextCursor } : { data: rows };
    },
  );
  return { items: result.data, nextCursor: result.nextCursor ?? null };
}
