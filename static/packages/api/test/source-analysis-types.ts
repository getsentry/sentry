/** The packed analysis contract needs neither compiler AST types nor HTTP globals. */
import { operations } from "@sentry/api/operations";
import { analyzeSourceApiUsage, type SourceApiAnalysisOptions } from "@sentry/api/source-analysis";

const options: SourceApiAnalysisOptions = {
  boundaries: ["defineTask"],
  requests: [{ functionName: "request", pathArgument: 0, optionsArgument: 1, queryProperty: "params", defaultMethod: "GET" }],
  queryParameters: ["dataset"],
  declarationFlags: ["guarded"],
};
const result = analyzeSourceApiUsage(new Map<string, string>(), operations, options);
const usage = result.exports.get("feature.ts")?.get("task");
const method: string | undefined = usage?.methods[0];
const query: string | undefined = usage?.operations[0]?.query?.dataset;
const factory: string | undefined = result.boundaries[0]?.factories[0];
const flag: string | undefined = result.boundaries[0]?.flags[0];

void [method, query, factory, flag];
