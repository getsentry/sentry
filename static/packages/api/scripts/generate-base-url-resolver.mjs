/**
 * Let hosts pick each request's base URL before the Fetch client builds the
 * URL, from the operation's routing declaration and the path it targets.
 */
import ts from "typescript";
import { replaceOnce, update } from "../lib/generated-source.mjs";
import { extractOperations } from "../lib/operation-catalog.mjs";

/** Add each operation's `routing` declaration to its request options, after `url`. */
function addOperationRouting(sourceSpec, source) {
  const routing = new Map(extractOperations(sourceSpec, source)
    .map(operation => [`${operation.method} ${operation.path}`, operation.routing]));
  const file = ts.createSourceFile("sdk.gen.ts", source, ts.ScriptTarget.Latest, true);
  const insertions = [];
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const { initializer: fn } of statement.declarationList.declarations) {
      const call = fn.body;
      const [request] = call.arguments;
      const url = request.properties.find(property => property.name?.getText(file) === "url");
      const key = `${call.expression.name.text.toUpperCase()} ${url.initializer.text}`;
      const declared = routing.get(key);
      if (!declared) throw new Error(`No routing declaration for ${key}`);
      routing.delete(key);
      const fields = Object.entries(declared).map(([name, value]) => `${name}: '${value}'`).join(", ");
      insertions.push([url.end, `,\n    routing: { ${fields} }`]);
    }
  }
  if (routing.size > 0) throw new Error(`Operations without SDK functions: ${[...routing.keys()].join(", ")}`);
  for (const [position, text] of insertions.reverse()) {
    source = source.slice(0, position) + text + source.slice(position);
  }
  return source;
}

export function emit({ sourceSpec }) {
  update("sdk.gen.ts", source => addOperationRouting(sourceSpec, source));

  update("client/types.gen.ts", source => {
    source = replaceOnce(source,
      "import type { Middleware } from './utils.gen';",
      `import type { Middleware } from './utils.gen';
import type { ApiPathScope } from '../api-client/api-path-scope';
import type { ApiOperationRouting } from '../operation-types';

/** The request a base URL is picked for; see {@link Config.resolveBaseUrl}. */
export type BaseUrlRequest = {
  /** The configured base URL, or \`''\` when none is set. */
  baseUrl: string;
  /** The request's path and query, as they follow the base URL. */
  url: string;
  /**
   * The organization, and project when present, the path targets
   * (\`parseApiPathScope\` in \`@sentry/api/client\`). Absent for unscoped paths.
   */
  scope?: ApiPathScope;
  /**
   * Where Sentry declares the operation available, for requests made by a
   * generated operation. Absent for raw requests.
   */
  routing?: ApiOperationRouting;
  /**
   * The value of the path parameter that \`routing.organizationParameter\`
   * names, when the operation declares one and the request sets it.
   */
  organization?: string;
};

/** Picks the base URL for one request; see {@link Config.resolveBaseUrl}. */
export type BaseUrlResolver = (request: BaseUrlRequest) => string | Promise<string>;`);
    source = replaceOnce(source,
      `  fetch?: typeof fetch;
  /**
   * Please don't use the Fetch client`,
      `  fetch?: typeof fetch;
  /**
   * Pick the base URL for each request, before its URL is built, such as the
   * region that serves the organization a cell operation targets. Called once per
   * request, after \`requestValidator\` and before request interceptors; its
   * result replaces \`baseUrl\` for that request.
   */
  resolveBaseUrl?: BaseUrlResolver;
  /**
   * Please don't use the Fetch client`);
    return replaceOnce(source,
      "  security?: ReadonlyArray<Auth>;\n  url: Url;\n}",
      `  security?: ReadonlyArray<Auth>;
  url: Url;
  /** Where Sentry declares the operation available; set by generated operations. */
  routing?: ApiOperationRouting;
}`);
  });

  update("client/client.gen.ts", source => {
    source = replaceOnce(source,
      "import type { Client, Config, RequestOptions, ResolvedRequestOptions } from './types.gen';",
      `import { withoutTrailingSlashes } from '../api-client/api-base-url';
import { parseApiPathScope } from '../api-client/api-path-scope';
import type { BaseUrlRequest, BaseUrlResolver, Client, Config, RequestOptions, ResolvedRequestOptions } from './types.gen';`);
    source = replaceOnce(source,
      "export const createClient = (config: Config = {}): PreparedClient => {",
      `/** The base URL \`resolve\` picks for a request to \`url\`, without trailing slashes. */
const resolveBaseUrl = async (
  resolve: BaseUrlResolver,
  baseUrl: string,
  url: string,
  { path, routing }: Pick<RequestOptions, 'path' | 'routing'>,
): Promise<string> => {
  const request: BaseUrlRequest = { baseUrl, url };
  const scope = parseApiPathScope(url);
  if (scope) {
    request.scope = scope;
  }
  if (routing) {
    request.routing = routing;
    const organization = routing.organizationParameter === undefined
      ? undefined
      : (path as Record<string, unknown> | undefined)?.[routing.organizationParameter];
    if (organization !== undefined && organization !== null && organization !== '') {
      request.organization = String(organization);
    }
  }
  return withoutTrailingSlashes(await resolve(request));
};

export const createClient = (config: Config = {}): PreparedClient => {`);
    return replaceOnce(source,
      "    const url = buildUrl(resolvedOpts);\n",
      `    if (resolvedOpts.resolveBaseUrl) {
      resolvedOpts.baseUrl = await resolveBaseUrl(
        resolvedOpts.resolveBaseUrl,
        (resolvedOpts.baseUrl as string | undefined) ?? '',
        buildUrl({ ...resolvedOpts, baseUrl: '' }),
        resolvedOpts,
      );
    }
    const url = buildUrl(resolvedOpts);
`);
  });

  update("client/index.ts", source => replaceOnce(source,
    "export type {\n  Client,",
    "export type {\n  BaseUrlRequest,\n  BaseUrlResolver,\n  Client,",
  ));
}
