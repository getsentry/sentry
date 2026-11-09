/**
 * Client-side query defaults for specific operations.
 *
 * These are SDK choices, not API facts: the server's own default is unchanged,
 * so they stay out of the OpenAPI schema. Callers override a default by passing
 * the parameter themselves; `[]` sends nothing. Only array-valued enum query
 * parameters are supported, so that `[]` is always an explicit, type-safe
 * opt-out.
 */
import ts from "typescript";

// Skips the next/previous-event Snuba queries. No known SDK consumer reads the
// adjacent IDs; pass `collapse: []` to get them.
const SKIP_ADJACENT_EVENTS = {
  query: { collapse: ["adjacentEvents"] },
  effect: "skips looking up the neighboring events (`nextEventID` and `previousEventID` are `null`)",
};

/**
 * Keyed by `${METHOD} ${path}`. Each value must be in the parameter's enum.
 * `effect` completes "By default, the SDK sends `…`, which …" in the JSDoc.
 */
export const QUERY_DEFAULTS = new Map([
  // getsentry/sentry#129094
  ["GET /api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/events/{event_id}/", SKIP_ADJACENT_EVENTS],
  // getsentry/sentry#129123
  ["GET /api/0/projects/{organization_id_or_slug}/{project_id_or_slug}/events/{event_id}/", SKIP_ADJACENT_EVENTS],
]);

/** Fail the build when the schema no longer documents a configured default. */
function validate(spec, route, query) {
  const [method, path] = route.split(" ");
  const operation = spec.paths?.[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`Query default for missing operation: ${route}`);
  for (const [name, values] of Object.entries(query)) {
    const schema = operation.parameters?.find(p => p.in === "query" && p.name === name)?.schema;
    if (schema?.type !== "array" || !Array.isArray(schema.items?.enum)) {
      throw new Error(`Query default ${name} is not an array enum parameter: ${route}`);
    }
    if (!Array.isArray(values) || values.length === 0 || values.some(value => !schema.items.enum.includes(value))) {
      throw new Error(`Query default ${name} must be a non-empty list of documented values: ${route}`);
    }
  }
}

/**
 * Rewrite sdk.gen.ts so each configured operation fills missing query defaults.
 * Standalone functions, bound client methods, and generated wrappers all call
 * these functions, so they share one behavior.
 * @param {{paths: object}} spec OpenAPI document the SDK was generated from.
 * @param {string} text Contents of sdk.gen.ts.
 * @param {Map<string, {query: Record<string, unknown[]>, effect: string}>} defaults
 * @returns {string} Rewritten sdk.gen.ts.
 */
export function applyQueryDefaults(spec, text, defaults = QUERY_DEFAULTS) {
  for (const [route, { query }] of defaults) validate(spec, route, query);

  const source = ts.createSourceFile("sdk.gen.ts", text, ts.ScriptTarget.Latest, true);
  const edits = [];
  const applied = new Set();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const fn = declaration.initializer;
      const call = fn && ts.isArrowFunction(fn) && ts.isCallExpression(fn.body) && fn.body;
      const request = call && ts.isPropertyAccessExpression(call.expression) && call.arguments[0];
      if (!request || !ts.isObjectLiteralExpression(request)) continue;
      const url = request.properties.find(property =>
        ts.isPropertyAssignment(property) && property.name.getText(source) === "url");
      if (!url || !ts.isStringLiteralLike(url.initializer)) continue;
      const route = `${call.expression.name.text.toUpperCase()} ${url.initializer.text}`;
      const entry = defaults.get(route);
      if (!entry) continue;

      const spread = request.properties.at(-1);
      if (!spread || !ts.isSpreadAssignment(spread) || spread.expression.getText(source) !== "options") {
        throw new Error(`Expected options to be spread last for ${route}`);
      }
      // `??` keeps caller values, including `[]`, which serializes to nothing.
      const fields = Object.entries(entry.query).map(([name, values]) =>
        `${JSON.stringify(name)}: options?.query?.[${JSON.stringify(name)}] ?? ${JSON.stringify(values)}`);
      edits.push({ start: spread.end, end: spread.end, text: `,\n    query: { ...options?.query, ${fields.join(", ")} }` });

      const doc = statement.jsDoc?.at(-1);
      if (doc) {
        const sends = Object.entries(entry.query).map(([name, values]) => `\`${name}: ${JSON.stringify(values)}\``).join(", ");
        const optOut = Object.keys(entry.query).map(name => `\`${name}: []\``).join(", ");
        const close = doc.end - 2;
        edits.push({
          start: close,
          end: close,
          text: `*\n * By default, the SDK sends ${sends}, which ${entry.effect}.` +
            ` Passing the parameter replaces the default; ${optOut} sends none.\n `,
        });
      }
      applied.add(route);
    }
  }
  const missing = [...defaults.keys()].filter(route => !applied.has(route));
  if (missing.length > 0) throw new Error(`Query defaults for missing SDK operations: ${missing.join(", ")}`);

  for (const { start, end, text: insert } of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, start) + insert + text.slice(end);
  }
  return text;
}
