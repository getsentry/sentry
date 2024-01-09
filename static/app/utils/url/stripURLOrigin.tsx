import {safeURL} from 'sentry/utils/url/safeURL';

/**
 * Accept a url like:
 * `https://example.com/path/name?query=params#hash` and return
 * `/path/name?query=params#hash`
 */
export default function stripURLOrigin(url: string): string {
  const parsedUrl = safeURL(url);

  if (!parsedUrl) {
    return url;
  }

  return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
}
