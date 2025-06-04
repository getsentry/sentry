import type {Client, Scope} from '@sentry/core';

type V8Carrier = {
  stack: {
    getScope?: () => Scope;
  };
};

type LegacyCarrier = {
  /** pre-v8 way of accessing scope (v7 and earlier) */
  hub?: {
    getClient?: () => Client;
    getScope?: () => Scope;
  };
};

type VersionedCarrier = {version: string} & Record<Exclude<string, 'version'>, V8Carrier>;

type WindowWithSentry = Window & {
  __SENTRY__?: LegacyCarrier & VersionedCarrier;
};

export function useScopeAndClient() {
  const sentryCarrier = (window as WindowWithSentry).__SENTRY__;
  const sentryScope = sentryCarrier && getSentryScope(sentryCarrier);
  const sentryClient = sentryCarrier && getSentryClient(sentryCarrier);

  if (!sentryScope || !sentryClient) {
    // using console log for now, will change this when moving to dev tool bar repo
    // eslint-disable-next-line no-console
    console.log(
      "Couldn't find a Sentry SDK scope or client. Make sure you're using a Sentry SDK with version 7.x or above"
    );
  }

  return {scope: sentryScope, client: sentryClient};
}

/**
 * Accesses the `window.__SENTRY__` carrier object and tries to get the Sentry scope
 * from it. This function supports all carrier object structures from v7 to all versions
 * of v8.
 */
function getSentryScope(
  sentryCarrier: LegacyCarrier & VersionedCarrier
): Scope | undefined {
  // 8.6.0+ way to get the scope
  if (sentryCarrier.version) {
    const versionedCarrier = sentryCarrier[sentryCarrier.version];
    const scope =
      typeof versionedCarrier?.stack?.getScope === 'function'
        ? versionedCarrier?.stack?.getScope?.()
        : undefined;
    return scope;
  }

  // pre-8.6.0 (+v7) way to get the scope
  if (sentryCarrier.hub) {
    const hub = sentryCarrier.hub;
    if (typeof hub.getScope === 'function') {
      return hub.getScope();
    }
  }

  return undefined;
}

/**
 * Accesses the `window.__SENTRY__` carrier object and tries to get the Sentry client
 * from it. This function supports all carrier object structures from v7 to all versions
 * of v8.
 */
function getSentryClient(
  sentryCarrier: LegacyCarrier & VersionedCarrier
): Client | undefined {
  // 8.6.0+ way to get the client
  if (sentryCarrier.version) {
    const versionedCarrier = sentryCarrier[sentryCarrier.version];
    const scope =
      typeof versionedCarrier?.stack?.getScope === 'function'
        ? versionedCarrier?.stack?.getScope?.()
        : undefined;
    if (typeof scope?.getClient === 'function') {
      return scope.getClient();
    }
  }

  // pre-8.6.0 (+v7) way to get the client
  if (sentryCarrier.hub) {
    const hub = sentryCarrier.hub;
    if (typeof hub.getClient === 'function') {
      return hub.getClient();
    }
  }

  return undefined;
}
