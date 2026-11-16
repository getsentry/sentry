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

/**
 * A `resolveBaseUrl` that sends each operation Sentry declares cell-only to
 * the region `regionUrl` returns for its organization. Everything else keeps
 * the configured base URL: control and `both` operations, `unknown`
 * operations, raw requests, and cell operations whose region is unknown. It
 * never looks a region up itself, and trusts whatever URL `regionUrl` returns.
 */
export function routeCellOperations(regionUrl: RegionUrlLookup): BaseUrlResolver {
  return async (request) => {
    const { baseUrl, organization, routing } = request;
    if (routing?.silo !== "cell" || organization === undefined) {
      return baseUrl;
    }
    return (await regionUrl(organization, request)) ?? baseUrl;
  };
}
