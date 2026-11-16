/**
 * Browser auth utilities for @sentry/api.
 *
 * Provides a fetch wrapper that handles cookie-based session auth and
 * CSRF token injection, allowing the SDK to be used inside the Sentry
 * frontend without a Bearer token.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

/** Matches the standard fetch signature without Bun/Node runtime extensions. */
export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type BrowserClientOptions = {
  /** Cookie name to read the CSRF token from. Defaults to 'sc' (Sentry's Django default). */
  csrfCookieName?: string;
  /** Override the CSRF token getter — useful for testing. */
  getCsrfToken?: () => string;
  /** Base URL for all requests. Defaults to '' (same-origin relative URLs). */
  baseUrl?: string;
  /**
   * Origin of the page that sends the requests, which decides where the CSRF
   * token may go. Defaults to `location.origin`. With neither, only relative
   * URLs get the token.
   */
  origin?: string;
};

function readCookie(name: string): string {
  // SSR / Node environments have no document; return empty so no token is injected.
  if (typeof document === 'undefined') return '';
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    // Fall back to raw value if the cookie is malformed percent-encoded.
    return match[1]!;
  }
}

/** Whether `child` is `parent` or one of its subdomains, by whole labels. */
function isSameOrSubdomain(child: string[], parent: string[]): boolean {
  return (
    child.length >= parent.length &&
    child.slice(child.length - parent.length).every((label, i) => label === parent[i])
  );
}

/**
 * Whether a request to `target` may carry the page's CSRF token: the hosts
 * are equal, one is a parent or subdomain of the other, or they are sibling
 * subdomains under a parent of at least two labels (`us.sentry.io` and
 * `acme.sentry.io`). Hosts are compared by whole DNS labels.
 */
function isSimilarOrigin(target: URL, origin: URL): boolean {
  const targetHost = target.hostname.split('.');
  const originHost = origin.hostname.split('.');
  if (isSameOrSubdomain(targetHost, originHost) || isSameOrSubdomain(originHost, targetHost)) {
    return true;
  }
  const targetParent = targetHost.slice(1).join('.');
  return targetHost.length > 2 && targetParent === originHost.slice(1).join('.');
}

// Stands in for the page origin when there is none, so that only URLs that
// stay on it (relative ones) get the token.
const UNKNOWN_ORIGIN = 'https://unknown-origin.invalid';

/** Whether the request goes to the page's origin or a similar one. */
function mayCarryCsrfToken(input: RequestInfo | URL, opts: BrowserClientOptions): boolean {
  const url = input instanceof Request ? input.url : String(input);
  const origin =
    opts.origin ?? (typeof location === 'undefined' ? undefined : location.origin);
  if (origin === undefined) {
    return URL.canParse(url, UNKNOWN_ORIGIN) && new URL(url, UNKNOWN_ORIGIN).origin === UNKNOWN_ORIGIN;
  }
  if (!URL.canParse(origin) || !URL.canParse(url, origin)) return false;
  const target = new URL(url, origin);
  const page = new URL(origin);
  // From an https page, the token never goes over plain http.
  if (page.protocol === 'https:' && target.protocol !== 'https:') return false;
  return isSimilarOrigin(target, page);
}

/**
 * Returns a fetch wrapper that injects X-CSRFToken on state-changing requests
 * to the page's origin or a similar one (the same host, a parent or subdomain
 * of it, or a sibling subdomain), only over https from an https page, and
 * sends session cookies via
 * credentials: 'include'. Requests to other origins never get the token.
 *
 * Sentry's Django backend reads the CSRF token from the 'sc' cookie by default
 * (configurable via window.csrfCookieName in the frontend).
 *
 * Note: always sets credentials: 'include'; any credentials value in init is overridden.
 */
export function createBrowserFetch(opts: BrowserClientOptions = {}): FetchFn {
  const getCsrf = opts.getCsrfToken ?? (() => readCookie(opts.csrfCookieName ?? 'sc'));

  return (input, init) => {
    // init.method takes precedence; fall back to the Request object's method if
    // input is a Request, then to 'GET' — mirrors the Fetch spec resolution order.
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // Seed headers from the Request object when init provides none; otherwise
    // init.headers wins (Fetch spec: init completely replaces Request headers).
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (!SAFE_METHODS.has(method) && mayCarryCsrfToken(input, opts)) {
      const token = getCsrf();
      if (token) headers.set('X-CSRFToken', token);
    }
    return globalThis.fetch(input, {...init, headers, credentials: 'include'});
  };
}

/**
 * Returns configuration for a browser SDK instance with cookie-based session
 * auth and CSRF token injection. The base URL defaults to same-origin relative URLs.
 *
 * @example
 * import {createSentryClient} from '@sentry/api';
 * import {createBrowserSdkConfig} from '@sentry/api/browser';
 * const sentry = createSentryClient(
 *   createBrowserSdkConfig({baseUrl: 'https://sentry.example.com'}),
 * );
 * const {data, error} = await sentry.listOrganizations();
 */
export function createBrowserSdkConfig(opts: BrowserClientOptions = {}) {
  return {
    baseUrl: opts.baseUrl ?? '',
    fetch: createBrowserFetch(opts),
  } as const;
}
