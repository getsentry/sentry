import type { SENTRY_ERROR_EXTRA_KEYS, SentryOperationErrorCode } from "./error-codes.gen.ts";

/**
 * The generated SDK's non-throwing result shape.
 *
 * Defined locally so the hand-written helpers never import generated code.
 */
export type SdkResult<TData = unknown, TError = unknown> =
  | {
      data: TData;
      error?: never;
      request: Request;
      response: Response;
    }
  | {
      data?: never;
      error: TError;
      request: Request;
      response: Response | undefined;
    };

type ErrorStatus<TErrorMap> = Extract<keyof TErrorMap, number>;

/** An API error whose status and body were declared by the operation. */
export type DocumentedSentryApiError<TErrorMap> = {
  [TStatus in ErrorStatus<TErrorMap>]: SentryApiError<
    TStatus,
    TErrorMap[TStatus],
    true
  >;
}[ErrorStatus<TErrorMap>];

/** An API error returned under a status absent from the operation's schema. */
export type UndocumentedSentryApiError = SentryApiError<
  number,
  unknown,
  false
>;

/**
 * @deprecated Non-HTTP failures propagate unchanged. Typed-error helpers only
 * return HTTP failures and no longer produce this legacy wrapper.
 */
export type SentryApiTransportError = SentryApiError<
  undefined,
  unknown,
  false
>;

export type SentryApiResultError<TErrorMap> =
  | DocumentedSentryApiError<TErrorMap>
  | UndocumentedSentryApiError;

export type NarrowedResult<TData, TErrorMap> =
  | { ok: true; data: TData; response: Response }
  | { ok: false; error: SentryApiResultError<TErrorMap> };

/**
 * Codes the backend sends, from the spec: those of its `SentryAPIException`
 * subclasses, and the other `code` values operations document in their error
 * responses, such as Seer's `seer_out_of_credits`.
 */
export type KnownSentryErrorCode = keyof typeof SENTRY_ERROR_EXTRA_KEYS | SentryOperationErrorCode;

/** The string fields each `SentryAPIException` code's `extra` can carry. */
export type SentryErrorExtra<TCode extends keyof typeof SENTRY_ERROR_EXTRA_KEYS> = {
  [TKey in (typeof SENTRY_ERROR_EXTRA_KEYS)[TCode][number]]?: string;
};

/** A known code, or another code the server sends. */
export type SentryErrorCode = KnownSentryErrorCode | (string & {});

/** The `detail` of a `{"detail": {"code", "message", "extra"}}` error body. */
export type SentryErrorDetail = {
  code: SentryErrorCode;
  message: string;
  extra: Record<string, unknown>;
};

/** Read a `SentryAPIException` body; undefined for any other body. */
export function readSentryErrorDetail(body: unknown): SentryErrorDetail | undefined {
  if (typeof body !== "object" || body === null || !("detail" in body)) {
    return undefined;
  }
  const { detail } = body;
  if (typeof detail !== "object" || detail === null || !("code" in detail) || typeof detail.code !== "string" || detail.code === "") {
    return undefined;
  }
  const extra = "extra" in detail ? detail.extra : undefined;
  return {
    code: detail.code,
    message: "message" in detail && typeof detail.message === "string" ? detail.message : "",
    extra: typeof extra === "object" && extra !== null && !Array.isArray(extra) ? Object.fromEntries(Object.entries(extra)) : {},
  };
}

/** Read a body with a top-level string `code`; its other fields stay on `body`. */
function readTopLevelCode(body: unknown): SentryErrorDetail | undefined {
  if (typeof body !== "object" || body === null || !("code" in body) || typeof body.code !== "string" || body.code === "") {
    return undefined;
  }
  return { code: body.code, message: "detail" in body && typeof body.detail === "string" ? body.detail : "", extra: {} };
}

/** An API failure with its parsed body and raw response. */
export class SentryApiError<
  TStatus extends number | undefined = number | undefined,
  TBody = unknown,
  TDocumented extends boolean = boolean,
> extends Error {
  readonly status: TStatus;
  readonly body: TBody;
  readonly response: Response | undefined;
  readonly documented: TDocumented;
  readonly request?: Request;
  /** Original response text, captured during the same read as the parsed body. */
  readonly rawBody?: string;
  // `declare`: errors from other bodies keep their shape, without these keys.
  /**
   * The `code` of a `{"detail": {"code", "message", "extra"}}` body, which the
   * backend's `SentryAPIException` sends, or else a top-level string `code`,
   * such as Seer's `{"detail", "code", "denialReason"}` 402.
   */
  declare readonly code?: SentryErrorCode;
  /** That body's `message`, or a top-level body's string `detail`. `message` stays this error's own. */
  declare readonly detailMessage?: string;
  /** That body's `extra`, such as `loginUrl` for `sso-required`; empty for a top-level `code`. */
  declare readonly extra?: Record<string, unknown>;

  constructor(
    status: TStatus,
    body: TBody,
    response: Response | undefined,
    documented: TDocumented,
    message = status === undefined
      ? "Sentry API request failed before receiving a response"
      : `Sentry API request failed with status ${status}`,
    options?: ErrorOptions & { request?: Request; rawBody?: string },
  ) {
    super(message, options);
    this.name = "SentryApiError";
    this.status = status;
    this.body = body;
    this.response = response;
    this.documented = documented;
    this.request = options?.request;
    this.rawBody = options?.rawBody;
    const detail = readSentryErrorDetail(body) ?? readTopLevelCode(body);
    if (detail) {
      this.code = detail.code;
      this.detailMessage = detail.message;
      this.extra = detail.extra;
    }
  }
}

/** Whether `error` is a `SentryApiError` whose body has the given `code`. */
export function isSentryErrorCode<TCode extends SentryErrorCode>(
  error: unknown,
  code: TCode,
): error is SentryApiError & { code: TCode; detailMessage: string; extra: Record<string, unknown> } {
  return error instanceof SentryApiError && error.code === code;
}

/** A `SentryApiError`'s request and response fields; see `getSentryApiErrorDetails`. */
export type SentryApiErrorDetails = {
  /** The request method, or `GET` when the error has no request. */
  method: string;
  /** The request URL's path, without origin or query, when there is a request. */
  path?: string;
  status?: number;
  statusText?: string;
  /** The parsed response body, when it was JSON. */
  responseJSON?: unknown;
  /** The response text, when the transport read it. */
  responseText?: string;
  /** `METHOD /path status`, with `n/a` for a missing status, such as `GET /api/0/organizations/ 404`. */
  summary: string;
};

/**
 * Collect what an application's own error class usually carries from a
 * `SentryApiError`, such as in an error interceptor that maps SDK errors.
 * Pass the interceptor's `request` for errors that do not carry one.
 *
 * @example
 * ```ts
 * sentry.client.interceptors.error.use((error, _response, request) =>
 *   error instanceof SentryApiError
 *     ? new AppRequestError(getSentryApiErrorDetails(error, request), { cause: error })
 *     : error,
 * );
 * ```
 */
export function getSentryApiErrorDetails(
  error: SentryApiError,
  request: Request | undefined = error.request,
): SentryApiErrorDetails {
  const method = request?.method ?? "GET";
  const path = request === undefined ? undefined : new URL(request.url).pathname;
  // The transport keeps a body that is not JSON as its text.
  const isJson = error.rawBody === undefined
    ? typeof error.body === "object" && error.body !== null
    : error.body !== error.rawBody;
  const details: SentryApiErrorDetails = {
    method,
    summary: [method, path, error.status ?? "n/a"].filter((part) => part !== undefined).join(" "),
  };
  if (path !== undefined) details.path = path;
  if (error.status !== undefined) details.status = error.status;
  if (error.response !== undefined) details.statusText = error.response.statusText;
  if (isJson) details.responseJSON = error.body;
  if (error.rawBody !== undefined) details.responseText = error.rawBody;
  return details;
}

/**
 * Convert an SDK result to a status-discriminated HTTP result.
 *
 * Prefer the generated `narrowError_<operation>` wrappers. They supply the
 * operation's complete error map and documented statuses automatically.
 * Base SentryApiError instances for this response are reclassified, including
 * ones supplied by an interceptor. Other errors (including subclasses) are
 * thrown unchanged. Status narrowing does not validate the response body.
 */
export const narrowError = <TData, TErrorMap>(
  result: SdkResult<TData>,
  documentedStatuses: ReadonlyArray<ErrorStatus<TErrorMap>>,
): NarrowedResult<TData, TErrorMap> => {
  if (!("error" in result)) {
    return {
      ok: true,
      data: result.data,
      response: result.response,
    };
  }

  const original = result.error;
  if (
    !(original instanceof SentryApiError) ||
    original.constructor !== SentryApiError ||
    typeof original.status !== "number" ||
    result.response === undefined ||
    original.response !== result.response
  ) {
    throw original;
  }

  const status = original.status;
  const documented = documentedStatuses.includes(
    status as ErrorStatus<TErrorMap>,
  );
  const error = new SentryApiError(
    status,
    original.body,
    original.response,
    documented,
    original.message,
    {
      cause: original.cause,
      request: original.request ?? result.request,
      rawBody: original.rawBody,
    },
  );

  // OpenAPI binds each documented response status to its body schema. The
  // generated SDK flattens that map, so restore the relationship here.
  return {
    ok: false,
    error: error as SentryApiResultError<TErrorMap>,
  };
};

/**
 * Call an SDK operation and narrow its default HTTP errors by status.
 * Generated operation wrappers use this helper. Errors outside narrowError's
 * HTTP contract reject without being relabeled or wrapped.
 */
export const callWithTypedErrors = async <TData, TErrorMap>(
  call: () => Promise<SdkResult<TData>>,
  documentedStatuses: ReadonlyArray<ErrorStatus<TErrorMap>>,
): Promise<NarrowedResult<TData, TErrorMap>> => {
  return narrowError<TData, TErrorMap>(await call(), documentedStatuses);
};
