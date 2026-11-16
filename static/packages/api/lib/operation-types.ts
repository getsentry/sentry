/** Searchable query metadata from the release's OpenAPI specification. */
export type ApiQueryParameter = {
  /** Parameter name accepted by the operation. */
  readonly name: string;
  /** Whether the request must include this parameter. */
  readonly required: boolean;
  /** Usage description, when documented. */
  readonly description?: string;
  /** OpenAPI schema type, when declared. */
  readonly type?: string;
  /** Allowed scalar values, or allowed item values for an array parameter. */
  readonly enum?: readonly (string | number | boolean | null)[];
};

/** Where Sentry declares an operation available, from its `x-sentry-routing` OpenAPI extension. */
export type ApiOperationRouting = {
  /**
   * Declared availability: `control`, `cell`, `both`, or `unknown` when Sentry has no declaration.
   * This is not a preferred destination or a guarantee that a gateway forwards the request.
   * For `both`, results can differ by context, so callers keep their intended one.
   */
  readonly silo: "control" | "cell" | "both" | "unknown";
  /** The path parameter that identifies the organization, when there is one. */
  readonly organizationParameter?: string;
};

/** An operation shipped by this SDK version, without consumer-specific policy. */
export type ApiOperation = {
  /** Actual exported SDK function name, after name normalization. */
  readonly functionName: string;
  /** Original OpenAPI identifier; an empty string means it was not declared. */
  readonly operationId: string;
  /** HTTP method used by the generated operation. */
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "TRACE";
  /** OpenAPI path template, relative to `API_BASE_PATH`, such as `/organizations/{organization_id_or_slug}/`. */
  readonly path: string;
  /** Short operation description, when documented. */
  readonly summary?: string;
  /** Detailed operation description; empty when undocumented. */
  readonly description: string;
  /** Categories assigned by the OpenAPI specification. */
  readonly tags?: readonly string[];
  /** Parameter names occurring in the path template. */
  readonly pathParameters: readonly string[];
  /** Query parameters after applying operation overrides to path-level parameters. */
  readonly queryParameters: readonly ApiQueryParameter[];
  /** Whether OpenAPI explicitly marks the operation deprecated. */
  readonly deprecated: boolean;
  /**
   * Whether Sentry marks the operation experimental with `x-sentry-experimental`.
   * Sentry documents these operations as under active development and liable to change.
   */
  readonly experimental: boolean;
  /**
   * Whether resending an identical request after a timeout or 5xx cannot change the outcome.
   * Always true for GET, HEAD, OPTIONS, and TRACE; other methods only when Sentry marks them
   * with `x-sentry-idempotent`. False means "not known to be idempotent".
   */
  readonly idempotent: boolean;
  /** Where Sentry declares the operation available. */
  readonly routing: ApiOperationRouting;
};
