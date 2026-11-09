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
  }
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
