import { fileURLToPath } from "node:url";

/**
 * The files the package ships under spec/, by name, with their paths in the
 * repository. `make build-api-docs` writes the spec and the API ownership
 * stats, and `make build-rpc-schema` writes the RPC method schema.
 */
const repositoryPaths = {
  "openapi-derefed.json": "tests/apidocs/openapi-derefed.json",
  "api_ownership_stats_dont_modify.json": "src/sentry/apidocs/api_ownership_stats_dont_modify.json",
  "rpc_method_schema.json": ".artifacts/rpc_method_schema.json",
};

const root = new URL("../../../../", import.meta.url);
// A directory that holds all of them instead, such as one CI job's spec/
// output downloaded into another.
const dir = process.env.SENTRY_API_SPEC_DIR;

/** Where to copy each spec/ file from, by name. */
export const specFiles = Object.fromEntries(
  Object.entries(repositoryPaths).map(([name, path]) => [
    name,
    dir ? `${dir}/${name}` : fileURLToPath(new URL(path, root)),
  ]),
);
