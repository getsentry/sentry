/** A project endpoint answered for a project that was renamed; see `getSentryProjectRename`. */
export type SentryProjectRename = {
  organization: string;
  /** The slug the request used. */
  previousSlug: string;
  /** The project's current slug. */
  slug: string;
  /** The request URL with the current slug. */
  url: string;
};

/**
 * Report whether `response` says the requested project was renamed. Sentry
 * answers a request that uses a project's old slug with a 302 to the same URL
 * with the new slug. Fetch follows it by default, so this compares the request
 * URL with the final one; with `redirect: "manual"` outside browsers, it reads
 * the 302's `Location`. It only reports the rename and never redirects.
 */
export function getSentryProjectRename(request: Request, response: Response): SentryProjectRename | undefined {
  const location = response.redirected
    ? response.url
    : response.status === 302
      ? response.headers.get("Location")
      : null;
  if (!location) {
    return undefined;
  }
  const from = new URL(request.url);
  const to = new URL(location, request.url);
  if (from.origin !== to.origin || from.search !== to.search) {
    return undefined;
  }
  const before = from.pathname.split("/");
  const after = to.pathname.split("/");
  const changed = before.flatMap((segment, index) => (segment === after[index] ? [] : [index]));
  // Only the project slug in `.../projects/{organization}/{project}/...` changes.
  const [index] = changed;
  if (before.length !== after.length || changed.length !== 1 || index === undefined || before[index - 2] !== "projects") {
    return undefined;
  }
  return {
    organization: before[index - 1]!,
    previousSlug: before[index]!,
    slug: after[index]!,
    url: to.href,
  };
}
