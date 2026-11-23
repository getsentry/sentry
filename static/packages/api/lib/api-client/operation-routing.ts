/**
 * Routing generated operations by Sentry's declarations, with the host's own
 * knowledge of which region serves an organization.
 */

import type { BaseUrlRequest, BaseUrlResolver } from "../client/types.gen.js";

/**
 * The base URL of the region that serves `organization`, or undefined when the
 * host does not know it. Hosts answer from what they already have, such as a
 * cache of `links.regionUrl` from the organization listing.
 */
export type RegionUrlLookup = (
  organization: string,
  request: BaseUrlRequest,
) => string | undefined | Promise<string | undefined>;

/** Options for {@link routeCellOperations}. */
export type RouteCellOperationsOptions = {
  /**
   * Where raw requests go: requests without `routing`, such as
   * `client.prepareRequest` or `client.get` with a hand-written path.
   * `'baseUrl'`, the default, keeps the configured base URL. `'lookup'` sends
   * a raw request whose path names an organization (its `scope`) to the URL
   * the lookup returns for it, like a cell operation. Use it when the lookup
   * does more than find a region, such as picking the account or server that
   * knows the organization, and raw requests need that too.
   */
  rawRequests?: "baseUrl" | "lookup";
};

/**
 * A `resolveBaseUrl` that sends each operation Sentry declares cell-only to
 * the region `regionUrl` returns for its organization. Everything else keeps
 * the configured base URL: control and `both` operations, `unknown`
 * operations, cell operations whose region is unknown, and raw requests unless
 * `rawRequests` is `'lookup'`. It never looks a region up itself, and trusts
 * whatever URL `regionUrl` returns.
 */
export function routeCellOperations(
  regionUrl: RegionUrlLookup,
  { rawRequests = "baseUrl" }: RouteCellOperationsOptions = {},
): BaseUrlResolver {
  // The organization to look up, or undefined to keep the configured base URL.
  const organizationToRoute = ({ routing, organization, scope }: BaseUrlRequest) => {
    if (routing) {
      return routing.silo === "cell" ? organization : undefined;
    }
    return rawRequests === "lookup" ? scope?.organization : undefined;
  };
  return async (request) => {
    const organization = organizationToRoute(request);
    if (organization === undefined) {
      return request.baseUrl;
    }
    return (await regionUrl(organization, request)) ?? request.baseUrl;
  };
}
