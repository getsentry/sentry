/**
 * Joining the configured base URL and the API base path. It imports only the
 * base path, so the generated client can use it without pulling in
 * `@sentry/api/client`.
 */

import { API_BASE_PATH } from "../api-base-path.gen.js";

/** `baseUrl` without the trailing slashes it may end in. */
export function withoutTrailingSlashes(baseUrl: string): string {
  let end = baseUrl.length;
  while (end > 0 && baseUrl.charAt(end - 1) === "/") {
    end -= 1;
  }
  return baseUrl.slice(0, end);
}

/**
 * `baseUrl`, without the trailing slashes it may end in, followed by
 * {@link API_BASE_PATH}: `https://sentry.io` and `https://sentry.io/` both
 * give `https://sentry.io/api/0`, and no base URL gives `/api/0`.
 */
export function withApiBasePath(baseUrl: string | undefined): string {
  return `${withoutTrailingSlashes(baseUrl ?? "")}${API_BASE_PATH}`;
}
