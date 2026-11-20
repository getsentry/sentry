/**
 * Reads the API base path, such as `/api/0`, from the spec's server URL and
 * leaves every operation path relative to it.
 *
 * The spec declares it in `servers` (`https://{region}.sentry.io/api/0`), and
 * its paths are relative to it. The client takes the Sentry origin as
 * `baseUrl` and adds the base path itself, so the servers keep only their
 * origin.
 */

function trimTrailingSlashes(path) {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end -= 1;
  return path.slice(0, end);
}

function splitServerUrl(url) {
  if (!URL.canParse(url)) throw new Error(`Unsupported server URL: ${url}`);
  const { origin, pathname } = new URL(url);
  return { origin, path: trimTrailingSlashes(pathname) };
}

// TODO: Remove once Sentry's spec declares the base path in `servers`.
// Until then, every path starts with the same `/api/<version>/`.
function legacyBasePath(paths) {
  const prefixes = new Set(Object.keys(paths).map(path => {
    const [root, api, version, ...rest] = path.split("/");
    return root === "" && api === "api" && version && rest.length > 0 ? `/api/${version}` : undefined;
  }));
  const [prefix] = prefixes;
  if (prefixes.size !== 1 || prefix === undefined) {
    throw new Error("The server URL has no base path, and the paths do not share one");
  }
  return prefix;
}

/**
 * Make `spec`'s paths relative to its API base path, reduce its server URLs
 * to their origins, and return the base path. A spec without servers, such
 * as a test fixture, is left unchanged and has no base path.
 * @param {{servers?: {url: string}[], paths: Record<string, object>}} spec
 * @returns {string} The base path, such as `/api/0`, or `""`
 */
export function splitApiBasePath(spec) {
  if (!spec.servers?.length) return "";
  let basePath = splitServerUrl(spec.servers[0].url).path;
  if (basePath === "") {
    basePath = legacyBasePath(spec.paths);
    spec.paths = Object.fromEntries(
      Object.entries(spec.paths).map(([path, item]) => [path.slice(basePath.length), item]),
    );
  }

  // An operation can override the servers, but not move off the base path.
  const toOrigins = servers => servers.map(server => {
    const { origin, path } = splitServerUrl(server.url);
    if (path !== "" && path !== basePath) {
      throw new Error(`Server ${server.url} is not under the API base path ${basePath}`);
    }
    return { ...server, url: origin };
  });
  spec.servers = toOrigins(spec.servers);
  for (const pathItem of Object.values(spec.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.servers) operation.servers = toOrigins(operation.servers);
    }
  }
  return basePath;
}
