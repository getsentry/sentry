import type {Scope} from '@sentry/types';

type V8Carrier = {
  stack: {
    getScope?: () => Scope;
  };
};

type LegacyCarrier = {
  /** pre-v8 way of accessing scope (v7 and earlier) */
  hub?: {
    getScope?: () => Scope;
  };
};

type VersionedCarrier = {version: string} & Record<Exclude<string, 'version'>, V8Carrier>;

type WindowWithSentry = Window & {
  __SENTRY__?: LegacyCarrier & VersionedCarrier;
};

export default function useCurrentTransactionName() {
  const scope = getScope();
  const scopeData = scope.getScopeData();

  const search = toSearchTerm(scopeData.transactionName);

  return search;
}

function getScope() {
  const sentryCarrier = (window as WindowWithSentry).__SENTRY__;
  const sentryClient = sentryCarrier && getSentryScope(sentryCarrier);

  if (!sentryClient) {
    // TODO: find a way to get scope on v7 of the Sentry SDK
    throw Error(
      "Couldn't find a Sentry SDK client. Make sure you're using a Sentry SDK with version 7.x or 8.x"
    );
  }

  return sentryClient;
}

/**
 * Accesses the `window.__SENTRY__` carrier object and tries to get the Sentry client
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

export function toSearchTerm(transaction) {
  // finds parameterized parts of transaction name: /:param, /[param], /{param}, /<param>,
  const parameterizedRegex =
    /([\/])(([:]([^\/]*))|([\[]([^\/]*)[\]])|([{]([^\/]*)[}])|([<]([^\/]*)[>]))/g;

  transaction = transaction.replaceAll(parameterizedRegex, '/*');

  // replaces nonparameterized urls with /*/ ie. /12345/
  const nonparameterizedRegex = /([\/])([0-9]+)/g;
  transaction = transaction.replaceAll(nonparameterizedRegex, '/*');

  // Step 3: Join the array back into a string with '/'
  const searchTerm = `/${transaction}/`.replaceAll(/\/+/g, '/');
  return searchTerm;
}
