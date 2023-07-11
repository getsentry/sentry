import parseUrl from 'sentry/utils/url/parseUrl';

/**
 * Accept a url like:
 * `https://example.com/path/name?query=params#hash` and return
 * `/path/name?query=params#hash`
 */
export default function stripOrigin(url: string) {
  return url.replace(parseUrl(url)?.origin ?? '', '');
}
