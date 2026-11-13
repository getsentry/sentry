import { build } from "esbuild";
import { cpSync, appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { emitDeclarations } from "./lib/emit-declarations.mjs";
import { splitApiBasePath } from "./lib/api-base-path.mjs";
import { generateClient } from "./lib/hey-api.mjs";
import { normalizeSpec } from "./lib/normalize-spec.mjs";
import { specFiles } from "./lib/spec-files.mjs";

// 0. Collect the spec and the files built with it under spec/. Each api@
//    release attaches them as GitHub release assets (package-pack.yml). This
//    also fails fast when the repository has not built one of them yet.
mkdirSync("spec", { recursive: true });
for (const [name, source] of Object.entries(specFiles)) cpSync(source, `spec/${name}`);
// `node build.mjs --spec-only` stops here, for CI jobs that only need spec/.
if (process.argv.includes("--spec-only")) process.exit(0);

// 0.5 Normalize verbose English sentence operationIds to short REST-conventional
//     identifiers (e.g. "List Your Organizations" → "listOrganizations"), and
//     make every path relative to the API base path in the server URL.
//     Writes a temporary openapi-normalized.json that the generator reads instead
//     of the source spec. The source spec is never modified.
//     OperationIds that are already identifiers (no spaces) are left untouched —
//     those were set intentionally via @extend_schema(operation_id=...).
const normalizedSpec = normalizeSpec("./spec/openapi-derefed.json", "./openapi-normalized.json");

// 1. Generate TypeScript client from OpenAPI spec, including optional
//    Valibot and Zod schemas, with Hey API (lib/hey-api.mjs).
await generateClient("./openapi-normalized.json", "src");

// 2. Copy hand-written utilities into the generated src/ directory
cpSync("lib/sentry-pagination.ts", "src/sentry-pagination.ts");
cpSync("lib/sentry-errors.ts", "src/sentry-errors.ts");
cpSync("lib/browser-client.ts", "src/browser-client.ts");
cpSync("lib/source-analysis.ts", "src/source-analysis.ts");
cpSync("lib/api-client", "src/api-client", { recursive: true });

// 3. Patch the generated output and generate the rest from it, in this order,
//    in this process. Each step is a module in scripts/ whose `emit` does the
//    work; they share the parsed specs and lib/generated-source.mjs.
//    The generators are post-processors, not Hey API plugins, because the
//    plugin API is documented as in-development and unstable.
const sourceSpec = JSON.parse(readFileSync("./spec/openapi-derefed.json", "utf8"));
const apiBasePath = splitApiBasePath(sourceSpec);
const steps = [
  // Export the base path, and send every operation under it.
  "generate-api-base-path",
  // Keep the pinned Fetch generator's runtime and types aligned with our contract.
  "generate-response-contract",
  "generate-request-preparation",
  "generate-base-url-resolver",
  // Typed fetchPage / paginateAll / paginateUpTo wrappers for every operation
  // that accepts a `cursor` query parameter.
  "generate-pagination",
  "generate-error-results",
  "generate-query-enum-types",
  "constrain-throw-options",
  // Client-side query defaults (lib/query-defaults.mjs) go into the operations
  // themselves, so bound methods and generated wrappers inherit them.
  "apply-query-defaults",
  "generate-client",
  "generate-operations",
  // Use Valibot's description action for the descriptions, which getDescription reads.
  "describe-valibot-schemas",
  // Annotate schema constructors as pure and defer the default client so bundlers
  // can drop unused exports and importing the package does no eager work.
  "make-tree-shakeable",
];
for (const name of steps) {
  const { emit } = await import(`./scripts/${name}.mjs`);
  emit({ normalizedSpec, sourceSpec, apiBasePath });
}

// 4. Append re-exports to the generated index.ts so the pagination
//    utilities and the per-operation wrappers are part of the public API.
appendFileSync(
  "src/index.ts",
  [
    "",
    "export { API_BASE_PATH } from './api-base-path.gen.ts';",
    "export { callWithTypedErrors, narrowError, SentryApiError } from './sentry-errors.ts';",
    "export type { DocumentedSentryApiError, NarrowedResult, SentryApiResultError, SentryApiTransportError, SdkResult, UndocumentedSentryApiError } from './sentry-errors.ts';",
    "export { parseSentryLinkHeader, unwrapResult, unwrapPaginatedResult, fetchPage, paginateAll, paginateUpTo, consumePage } from './sentry-pagination.ts';",
    "export type { UnwrappedResult, PaginatedResponse, PaginatedCollection, PaginateAllOptions, PaginateUpToOptions, PageFetcher, BudgetedPageFetcher, CollectionPage, CollectionPageFetcher, PagePosition, PaginationContinuation } from './sentry-pagination.ts';",
    "export * from './error-results.gen.ts';",
    "export type * from './query-enums.gen.ts';",
    "export * from './pagination.gen.ts';",
    "export { createSentryClient } from './sentry-client.gen.ts';",
    "export type { SentryClient } from './sentry-client.gen.ts';",
    "export type { BaseUrlRequest, BaseUrlResolver, Config } from './client/index.ts';",
    "",
  ].join("\n"),
);

// 5. Create standalone entry points.
//    valibot/zod: validator-specific schemas with optional peer dependencies.
//    browser: CSRF + cookie auth helpers for browser/frontend use.
//    client, client/endpoints: the shared request layer, whose index files
//    are copied from lib/api-client/ in step 2.
writeFileSync("src/valibot.ts", 'export * from "./valibot.gen.ts";\n');
writeFileSync("src/zod.ts", 'export * from "./zod.gen.ts";\n');
writeFileSync("src/browser.ts", 'export * from "./browser-client.ts";\n');

// 6. Bundle into JS files and emit type declarations, at the same time.
//    The main entry stays self-contained (zero runtime deps).
//    Validator entries externalise their peers; the root stays dependency-free.
//    Runtime entries target the browser platform, so a Node built-in import
//    fails the build. source-analysis is a Node build tool and keeps node:path.
//    Declarations come from tsconfig.json; the validator schemas, which take
//    most of the checking time, each get their own worker.
const bundle = (entry, { external = [], platform = "browser" } = {}) =>
  build({
    entryPoints: [`src/${entry}.ts`],
    outdir: "dist",
    outbase: "src",
    bundle: true,
    format: "esm",
    platform,
    external,
    logLevel: "info",
  });
await Promise.all([
  bundle("index"),
  bundle("valibot", { external: ["valibot"] }),
  bundle("zod", { external: ["zod"] }),
  bundle("browser"),
  // Keep the package entries external so consumers share the root error classes.
  bundle("api-client/index", { external: ["@sentry/api", "http-cache-semantics", "p-limit"] }),
  bundle("api-client/endpoints/index", { external: ["@sentry/api", "@sentry/api/client"] }),
  bundle("operations"),
  bundle("source-analysis", { external: ["typescript"], platform: "node" }),
  emitDeclarations([["valibot.ts", "valibot.gen.ts"], ["zod.ts", "zod.gen.ts"]]),
]);
