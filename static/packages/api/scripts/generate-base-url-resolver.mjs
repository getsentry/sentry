/** Let hosts pick each request's base URL from its path before the Fetch client builds the URL. */
import { replaceOnce, update } from "../lib/generated-source.mjs";

export function emit() {
  update("client/types.gen.ts", source => {
    source = replaceOnce(source,
      "import type { Middleware } from './utils.gen';",
      `import type { Middleware } from './utils.gen';
import type { ApiPathScope } from '../api-client/api-path-scope';

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
};

/** Picks the base URL for one request; see {@link Config.resolveBaseUrl}. */
export type BaseUrlResolver = (request: BaseUrlRequest) => string | Promise<string>;`);
    return replaceOnce(source,
      `  fetch?: typeof fetch;
  /**
   * Please don't use the Fetch client`,
      `  fetch?: typeof fetch;
  /**
   * Pick the base URL for each request, before its URL is built, such as the
   * region that serves the organization the path targets. Called once per
   * request, after \`requestValidator\` and before request interceptors; its
   * result replaces \`baseUrl\` for that request.
   */
  resolveBaseUrl?: BaseUrlResolver;
  /**
   * Please don't use the Fetch client`);
  });

  update("client/client.gen.ts", source => {
    source = replaceOnce(source,
      "import type { Client, Config, RequestOptions, ResolvedRequestOptions } from './types.gen';",
      `import { parseApiPathScope } from '../api-client/api-path-scope';
import type { BaseUrlResolver, Client, Config, RequestOptions, ResolvedRequestOptions } from './types.gen';`);
    source = replaceOnce(source,
      "export const createClient = (config: Config = {}): PreparedClient => {",
      `/** The base URL \`resolve\` picks for a request to \`url\`, without trailing slashes. */
const resolveBaseUrl = async (
  resolve: BaseUrlResolver,
  baseUrl: string,
  url: string,
): Promise<string> => {
  const scope = parseApiPathScope(url);
  const resolved = await resolve(scope ? { baseUrl, url, scope } : { baseUrl, url });
  let end = resolved.length;
  while (end > 0 && resolved.charAt(end - 1) === '/') {
    end -= 1;
  }
  return resolved.slice(0, end);
};

export const createClient = (config: Config = {}): PreparedClient => {`);
    return replaceOnce(source,
      "    const url = buildUrl(resolvedOpts);\n",
      `    if (resolvedOpts.resolveBaseUrl) {
      resolvedOpts.baseUrl = await resolveBaseUrl(
        resolvedOpts.resolveBaseUrl,
        (resolvedOpts.baseUrl as string | undefined) ?? '',
        buildUrl({ ...resolvedOpts, baseUrl: '' }),
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
