/**
 * Reading the organization and project an API path targets. It imports only
 * the base path, so the generated client can use it without pulling in
 * `@sentry/api/client`.
 */

import { API_BASE_PATH } from "../api-base-path.gen.js";

/** The organization, and project when present, an API path targets. */
export type ApiPathScope = { organization: string; project?: string };

/**
 * Org and project slugs or numeric ids. Rejects schema placeholders such as
 * `{organization_id_or_slug}`, encoded values, and dot segments.
 */
const API_PATH_IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function isApiPathIdentifier(segment: string | undefined): segment is string {
  return segment !== undefined && API_PATH_IDENTIFIER.test(segment);
}

/** Path segments after {@link API_BASE_PATH}, or undefined for a URL outside the API. */
function apiPathSegments(urlOrPath: string): string[] | undefined {
  const isUrl = URL.canParse(urlOrPath);
  let path = isUrl
    ? new URL(urlOrPath).pathname
    : (urlOrPath.split(/[?#]/, 1)[0] ?? "");
  const apiIndex = path.indexOf(`${API_BASE_PATH}/`);
  if (apiIndex !== -1) {
    path = path.slice(apiIndex + API_BASE_PATH.length);
  } else if (isUrl) {
    return;
  }
  return path.split("/").filter((segment) => segment.length > 0);
}

/**
 * The organization, and project when present, a Sentry API request targets,
 * read from its path: `/organizations/{org}/`, `/projects/{org}/{project}/`,
 * `/teams/{org}/`, and `/organizations/{org}/projects/{project}/`.
 *
 * Accepts a full URL, whose path must contain {@link API_BASE_PATH} (a
 * self-hosted install may serve it under a prefix), or a path relative to it
 * with or without that prefix. Undefined for unscoped paths, list endpoints such
 * as `/organizations/`, and schema placeholders.
 *
 * Hosts with several credentials or regions use it to pick the one that
 * serves the organization: `createApiTransport` passes it to
 * `CredentialProvider.current`, and the generated client to
 * `Config.resolveBaseUrl`.
 */
export function parseApiPathScope(urlOrPath: string): ApiPathScope | undefined {
  const segments = apiPathSegments(urlOrPath);
  if (!segments) {
    return;
  }
  const [resource, organization, next, project] = segments;
  if (!isApiPathIdentifier(organization)) {
    return;
  }
  if (resource === "organizations") {
    return next === "projects" && isApiPathIdentifier(project)
      ? { organization, project }
      : { organization };
  }
  if (resource === "projects") {
    return isApiPathIdentifier(next)
      ? { organization, project: next }
      : { organization };
  }
  if (resource === "teams") {
    return { organization };
  }
  return;
}
