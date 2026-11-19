import type { ApiOperation } from "./operation-types.ts";

/** A JSON Schema from the release's dereferenced OpenAPI specification, as written there. */
export type ApiDocsSchema = { readonly [keyword: string]: unknown };

/** An API reference category. */
export type ApiDocsTag = {
  /** Name operations use in their `tags`. */
  readonly name: string;
  /** Markdown description, when documented. */
  readonly description?: string;
  /** Sidebar label (`x-sidebar-name`), when it differs from the name. */
  readonly sidebarName?: string;
  /** Whether the category page shows the description (`x-display-description`). */
  readonly displayDescription: boolean;
};

/** An operation parameter. */
export type ApiDocsParameter = {
  readonly name: string;
  readonly in: "path" | "query" | "header" | "cookie";
  readonly required: boolean;
  /** Markdown description, when documented. */
  readonly description?: string;
  /** Whether Sentry marks the parameter with `x-sentry-experimental`. */
  readonly experimental: boolean;
  readonly schema?: ApiDocsSchema;
};

/** The request body, from its first declared content type. */
export type ApiDocsRequestBody = {
  readonly contentType: string;
  readonly required: boolean;
  readonly schema?: ApiDocsSchema;
  readonly example?: unknown;
};

/** A named response example. */
export type ApiDocsExample = {
  readonly summary?: string;
  readonly value: unknown;
};

/** A documented response, with the content of its first declared content type. */
export type ApiDocsResponse = {
  /** HTTP status code, or `default`, as the specification keys it. */
  readonly status: string;
  readonly description: string;
  readonly contentType?: string;
  readonly schema?: ApiDocsSchema;
  readonly example?: unknown;
  readonly examples?: { readonly [name: string]: ApiDocsExample };
};

/** Everything the API reference shows for one operation. */
export type ApiDocsOperation = {
  /** Original OpenAPI identifier; an empty string means it was not declared. */
  readonly operationId: string;
  readonly method: ApiOperation["method"];
  /** OpenAPI path template, relative to `apiBasePath`, such as `/organizations/{organization_id_or_slug}/`. */
  readonly path: string;
  /** Title, as written in the specification, when documented. */
  readonly summary?: string;
  /** Markdown description, as written in the specification; empty when undocumented. */
  readonly description: string;
  readonly tags: readonly string[];
  /** Whether OpenAPI explicitly marks the operation deprecated. */
  readonly deprecated: boolean;
  /** Whether Sentry marks the operation with `x-sentry-experimental`. */
  readonly experimental: boolean;
  /** Origins of the servers that override the document's servers; empty when none do. */
  readonly servers: readonly string[];
  /** Accepted security requirements: each maps a scheme to the scopes it needs. */
  readonly security: readonly { readonly [scheme: string]: readonly string[] }[];
  /** Parameters after applying operation overrides to path-level parameters. */
  readonly parameters: readonly ApiDocsParameter[];
  readonly requestBody?: ApiDocsRequestBody;
  /** Responses in specification order. */
  readonly responses: readonly ApiDocsResponse[];
};

/** The API reference data for this SDK version. */
export type ApiDocs = {
  /** The path every operation path is relative to, such as `/api/0`, from the spec's server URL. */
  readonly apiBasePath: string;
  /** Categories in specification order. */
  readonly tags: readonly ApiDocsTag[];
  /** Operations in specification order. */
  readonly operations: readonly ApiDocsOperation[];
};
