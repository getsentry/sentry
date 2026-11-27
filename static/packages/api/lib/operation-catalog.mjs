/** Combine original OpenAPI metadata with the generated SDK's operation identities. */
import { HTTP_METHODS } from "./http-methods.mjs";
import { parseSdkOperations } from "./sdk-operations.mjs";

// RFC 9110 9.2.1: safe methods never change server state, so they are always idempotent.
const SAFE_METHODS = new Set(["get", "head", "options", "trace"]);

const SILOS = new Set(["control", "cell", "both", "unknown"]);

/**
 * Copy Sentry's `x-sentry-routing` declaration. An operation without one gets
 * `unknown`, the value Sentry uses when it has no declaration either.
 */
function routing(key, operation, pathParameters) {
  const declared = operation["x-sentry-routing"];
  if (declared === undefined) return { silo: "unknown" };
  const { silo, organizationParameter } = declared;
  if (!SILOS.has(silo)) throw new Error(`${key} declares an unsupported x-sentry-routing silo: ${silo}`);
  if (organizationParameter === undefined) return { silo };
  if (!pathParameters.includes(organizationParameter)) {
    throw new Error(`${key} declares x-sentry-routing organizationParameter ${organizationParameter}, which is not in its path`);
  }
  return { silo, organizationParameter };
}

const PROJECT_SCOPES = new Set(["path", "filter", "org-metadata"]);
const RESPONSE_SCOPE = "response:";
// RFC 6901: "/"-separated segments, with "~" only in the escapes "~0" and "~1". A "*" segment needs no special case.
const JSON_POINTER = /^(\/([^/~]|~[01])*)+$/;

/**
 * Copy Sentry's `x-sentry-project-scope` declaration, rejecting values that Sentry's
 * schema build would also reject. An operation without one gets no `projectScope`.
 */
function projectScope(key, method, operation) {
  const declared = operation["x-sentry-project-scope"];
  if (declared === undefined) return {};
  const invalid = reason => new Error(`${key} declares an unsupported x-sentry-project-scope ${JSON.stringify(declared)}: ${reason}`);
  if (typeof declared !== "string") throw invalid("the value must be a string");
  if (declared.startsWith(RESPONSE_SCOPE)) {
    if (method !== "get") throw invalid("response: is only for GET");
    if (!JSON_POINTER.test(declared.slice(RESPONSE_SCOPE.length))) {
      throw invalid("response: must be followed by a JSON pointer such as /project/id");
    }
    return { projectScope: declared };
  }
  if (!PROJECT_SCOPES.has(declared)) {
    throw invalid('the value must be "path", "filter", "org-metadata", or "response:<JSON pointer>"');
  }
  if (declared === "org-metadata" && method !== "get") throw invalid("org-metadata is only for GET");
  return { projectScope: declared };
}

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
      const pathParameters = [...path.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
      operations.push({
        functionName,
        operationId: operation.operationId ?? "",
        method: method.toUpperCase(),
        path,
        ...(operation.summary === undefined ? {} : { summary: operation.summary.trim() }),
        description: (operation.description ?? "").trim(),
        ...(operation.tags === undefined ? {} : { tags: operation.tags }),
        pathParameters,
        queryParameters: queryParameters(pathItem, operation),
        deprecated: operation.deprecated === true,
        // Sentry's schema build marks PUBLIC_EXPERIMENTAL endpoints with this extension.
        experimental: operation["x-sentry-experimental"] === true,
        // Other methods count only when Sentry marks them; PUT/DELETE handlers are not all idempotent.
        idempotent: SAFE_METHODS.has(method) || operation["x-sentry-idempotent"] === true,
        routing: routing(key, operation, pathParameters),
        ...projectScope(key, method, operation),
      });
    }
  }
  if (functions.size > 0) throw new Error(`SDK operations missing from OpenAPI: ${[...functions.keys()].join(", ")}`);
  return operations.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
