import type {Event, StackFrame} from '@sentry/core';

const BUNDLER_URL_PROTOCOL = 'webpack-internal:';

const FIRST_PARTY_HOSTS = ['sentry.io', 'sentry-cdn.com'];

const EXTENSION_URL_PROTOCOLS = [
  'chrome-extension:',
  'moz-extension:',
  'ms-browser-extension:',
  'safari-extension:',
  'safari-web-extension:',
];

const WEB_URL_PROTOCOLS = ['http:', 'https:'];

export function getFirstPartyOrigins(distPrefix: string | undefined): string[] {
  const {origin} = window.location;

  try {
    return [origin, new URL(distPrefix ?? '', origin).origin];
  } catch {
    return [origin];
  }
}

function parseFrameUrl(frame: StackFrame): URL | undefined {
  if (!frame.filename) {
    return undefined;
  }

  try {
    return new URL(frame.filename, window.location.origin);
  } catch {
    return undefined;
  }
}

function isFirstPartyOrigin(url: URL, firstPartyOrigins: string[]): boolean {
  return (
    firstPartyOrigins.includes(url.origin) ||
    FIRST_PARTY_HOSTS.some(
      host => url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
  );
}

/**
 * Whether a frame looks like code we serve. Only "seemingly": an injected
 * script that happens to be attributed to a URL of ours is indistinguishable
 * from our own code, so this errs towards claiming frames rather than
 * disowning them.
 */
export function isSeeminglyFirstPartyFrame(
  frame: StackFrame,
  firstPartyOrigins: string[]
): boolean {
  if (!frame.filename) {
    return false;
  }

  const url = parseFrameUrl(frame);
  if (!url) {
    return true;
  }

  if (url.protocol === BUNDLER_URL_PROTOCOL) {
    return true;
  }

  if (!isFirstPartyOrigin(url, firstPartyOrigins)) {
    return false;
  }

  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1).includes('.');
}

/**
 * Whether a frame is code someone else served. Unlike a frame we merely can't
 * attribute — `<anonymous>`, a document URL, a blob — this names a source we
 * know is not ours, which is why one is enough to disown a whole stack.
 */
export function isDefinitelyThirdPartyFrame(
  frame: StackFrame,
  firstPartyOrigins: string[]
): boolean {
  const url = parseFrameUrl(frame);
  if (!url) {
    return false;
  }

  if (EXTENSION_URL_PROTOCOLS.includes(url.protocol)) {
    return true;
  }

  if (!WEB_URL_PROTOCOLS.includes(url.protocol)) {
    return false;
  }

  return !isFirstPartyOrigin(url, firstPartyOrigins);
}

/**
 * Third-party code — vendor snippets and browser extensions — throws on our
 * pages without ever entering our own code. A stack we can't read at all
 * (cross-origin, truncated) has no frames, and is kept: it's indistinguishable
 * from a real error that lost its stack.
 */
export function isThirdPartyScriptEvent(
  event: Event,
  firstPartyOrigins: string[]
): boolean {
  const frames = event.exception?.values?.flatMap(
    value => value.stacktrace?.frames ?? []
  );

  if (!frames?.length) {
    return false;
  }

  let hadFirstPartyFrame = false;

  for (const frame of frames) {
    if (isDefinitelyThirdPartyFrame(frame, firstPartyOrigins)) {
      return true;
    }

    if (isSeeminglyFirstPartyFrame(frame, firstPartyOrigins)) {
      hadFirstPartyFrame = true;
    }
  }

  return !hadFirstPartyFrame;
}
