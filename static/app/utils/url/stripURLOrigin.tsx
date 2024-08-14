import {safeURL} from 'sentry/utils/url/safeURL';

/**
 * Accept a url like:
 * `https://example.com/path/name?query=params#hash` and return
 * `/path/name?query=params#hash`
 */
export default function stripURLOrigin(url: string): string {
  const parsedUrl = safeURL(url);

  if (parsedUrl === undefined) {
    return url;
  }

  // We cannot do something like parsedUrl.pathname + parsedUrl.search + parsedUrl.hash
  // as the parsed representation of the url may not exactly match the string url argument.
  // See more detailed explanation in https://github.com/getsentry/sentry/pull/62839#discussion_r1446450773
  // take last n characters where n is the length of the url - length of the origin
  return url.slice(-(url.length - parsedUrl.origin.length));
}
