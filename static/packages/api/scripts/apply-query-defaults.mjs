/** Apply lib/query-defaults.mjs to the generated SDK operations in place. */
import { update } from "../lib/generated-source.mjs";
import { applyQueryDefaults, QUERY_DEFAULTS } from "../lib/query-defaults.mjs";

export function emit({ sourceSpec }) {
  update("sdk.gen.ts", source => applyQueryDefaults(sourceSpec, source));
  console.log(`apply-query-defaults: ${QUERY_DEFAULTS.size} operation(s)`);
}
