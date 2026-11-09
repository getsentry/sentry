/** Combine original OpenAPI metadata with the generated SDK's operation identities. */
import { parseSdkOperations } from "./sdk-operations.mjs";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
// RFC 9110 9.2.1: safe methods never change server state, so they are always idempotent.
const SAFE_METHODS = new Set(["get", "head", "options", "trace"]);

/** Operation-level parameters replace path-level parameters with the same name/in. */
function queryParameters(pathItem, operation) {
  const parameters = new Map();
  for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
    if (parameter.in === "query") parameters.set(parameter.name, parameter);
  }
  return [...parameters.values()].map(parameter => {
    const schema = parameter.schema;
    const values = schema?.type === "array" ? schema.items?.enum : schema?.enum;
    return {
      name: parameter.name,
      required: parameter.required === true,
      ...(parameter.description === undefined ? {} : { description: parameter.description.trim() }),
      ...(schema?.type === undefined ? {} : { type: schema.type }),
      ...(values === undefined ? {} : {
        enum: values.filter(value => value === null || ["string", "number", "boolean"].includes(typeof value)),
      }),
    };
  });
}

/**
 * Build a deterministic discovery catalog for every generated SDK operation.
 * Preserve original operationIds, which can differ from normalized function names.
 * @param {{paths: object}} spec Original dereferenced OpenAPI document.
 * @param {string} sdkSource Contents of sdk.gen.ts generated from its normalized copy.
 * @returns {import("./operation-types.ts").ApiOperation[]}
 */
export function extractOperations(spec, sdkSource) {
  const sdk = parseSdkOperations(sdkSource);
  const functions = new Map(sdk.map(operation => [`${operation.method} ${operation.path}`, operation.functionName]));
  const operations = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      const key = `${method.toUpperCase()} ${path}`;
      const functionName = functions.get(key);
      if (!functionName) throw new Error(`Missing SDK operation for ${key}`);
      functions.delete(key);
      operations.push({
        functionName,
        operationId: operation.operationId ?? "",
        method: method.toUpperCase(),
        path,
        ...(operation.summary === undefined ? {} : { summary: operation.summary.trim() }),
        description: (operation.description ?? "").trim(),
        ...(operation.tags === undefined ? {} : { tags: operation.tags }),
        pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map(match => match[1]),
        queryParameters: queryParameters(pathItem, operation),
        deprecated: operation.deprecated === true,
        // Sentry's schema build marks PUBLIC_EXPERIMENTAL endpoints with this extension.
        experimental: operation["x-sentry-experimental"] === true,
        // Other methods count only when Sentry marks them; PUT/DELETE handlers are not all idempotent.
        idempotent: SAFE_METHODS.has(method) || operation["x-sentry-idempotent"] === true,
      });
    }
  }
  if (functions.size > 0) throw new Error(`SDK operations missing from OpenAPI: ${[...functions.keys()].join(", ")}`);
  return operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
