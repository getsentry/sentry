function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * Accept a url like:
 * `https://example.com/path/name?query=params#hash` and return
 * `/path/name?query=params#hash`
 */
export default function stripOrigin(url: string) {
  return url.replace(parseUrl(url)?.origin ?? '', '');
}
