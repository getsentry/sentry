/** Project the dereferenced OpenAPI document onto what an API reference shows. */
import { splitApiBasePath } from "./api-base-path.mjs";
import { HTTP_METHODS } from "./http-methods.mjs";

/** Keep `key` only when the source defines it, so the output has no `undefined` values. */
const optional = (key, value) => (value === undefined ? {} : { [key]: value });

function tag(source) {
  return {
    name: source.name,
    ...optional("description", source.description),
    ...optional("sidebarName", source["x-sidebar-name"]),
    displayDescription: source["x-display-description"] === true,
  };
}

/** Operation-level parameters replace path-level parameters with the same name/in. */
function parameters(pathItem, operation) {
  const merged = new Map();
  for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
    merged.set(`${parameter.in} ${parameter.name}`, parameter);
  }
  return [...merged.values()].map(parameter => ({
    name: parameter.name,
    in: parameter.in,
    required: parameter.required === true,
    ...optional("description", parameter.description),
    experimental: parameter["x-sentry-experimental"] === true,
    ...optional("schema", parameter.schema),
  }));
}

/** The first declared content type and its media type object, if any. */
function firstContent(content) {
  const [entry] = Object.entries(content ?? {});
  return entry ? { contentType: entry[0], media: entry[1] } : undefined;
}

function requestBody(source) {
  const first = firstContent(source?.content);
  if (!first) return undefined;
  return {
    contentType: first.contentType,
    required: source.required === true,
    ...optional("schema", first.media.schema),
    ...optional("example", first.media.example),
  };
}

function response(status, source) {
  const first = firstContent(source.content);
  return {
    status,
    description: source.description ?? "",
    ...(first
      ? {
          contentType: first.contentType,
          ...optional("schema", first.media.schema),
          ...optional("example", first.media.example),
          ...optional("examples", first.media.examples),
        }
      : {}),
  };
}

/**
 * Build the API reference data for every operation, in specification order.
 * Text fields are copied as written, so pages render exactly what the spec says.
 * Paths are relative to the API base path and server URLs keep only their
 * origin, as in the client and the operation catalog.
 * @param {{servers?: {url: string}[], paths: object, tags?: object[]}} source Dereferenced
 *   OpenAPI document, such as `tests/apidocs/openapi-derefed.json` from `make build-api-docs`.
 *   It is not modified.
 * @returns {import("./docs-types.ts").ApiDocs}
 */
export function extractDocs(source) {
  const spec = structuredClone(source);
  const apiBasePath = splitApiBasePath(spec);
  const operations = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      const body = requestBody(operation.requestBody);
      operations.push({
        operationId: operation.operationId ?? "",
        method: method.toUpperCase(),
        path,
        ...optional("summary", operation.summary),
        description: operation.description ?? "",
        tags: operation.tags ?? [],
        deprecated: operation.deprecated === true,
        experimental: operation["x-sentry-experimental"] === true,
        servers: (operation.servers ?? []).map(server => server.url),
        security: operation.security ?? [],
        parameters: parameters(pathItem, operation),
        ...optional("requestBody", body),
        responses: Object.entries(operation.responses ?? {}).map(([status, source]) => response(status, source)),
      });
    }
  }
  return { apiBasePath, tags: (spec.tags ?? []).map(tag), operations };
}
