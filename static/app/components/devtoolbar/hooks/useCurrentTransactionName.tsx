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
  const scopeData = scope?.getScopeData();

  const search = toSearchTerm(scopeData?.transactionName);

  return search;
}

function getScope() {
  const sentryCarrier = (window as WindowWithSentry).__SENTRY__;
  const sentryScope = sentryCarrier && getSentryScope(sentryCarrier);

  if (!sentryScope) {
    // using console log for now, will change this when moving to dev tool bar repo
    // eslint-disable-next-line no-console
    console.log(
      "Couldn't find a Sentry SDK scope. Make sure you're using a Sentry SDK with version 7.x or 8.x"
    );
  }

  return sentryScope;
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

export function toSearchTerm(transaction) {
  // finds dynamic parts of transaction name to change into search term
  let modifiedTransaction = transaction;

  // ([:]([^\/]*)) matches :param used by React, Vue, Angular, Express, Ruby on Rails, Phoenix, Solid
  // ([\[]([^\/]*)[\]]) matches [param] used by Next.js, Nuxt.js, Svelte
  // ([{]([^\/]*)[}]) matches {param} used by ASP.NET Core, Laravel, Symfony
  // ([<]([^\/]*)[>]) matches <param> used by Flask, Django
  const parameterizedRegex =
    /([\/])(([:]([^\/]*))|([\[]([^\/]*)[\]])|([{]([^\/]*)[}])|([<]([^\/]*)[>]))/g;
  modifiedTransaction = modifiedTransaction.replaceAll(parameterizedRegex, '/*');

  // transaction name could contain the resolved URL instead of the route pattern (ie actual id instead of :id)
  // match any param that starts with a number eg. /12353
  const nonparameterizedRegex = /([\/])([0-9]+)/g;
  modifiedTransaction = modifiedTransaction.replaceAll(nonparameterizedRegex, '/*');

  // Join the array back into a string with '/'
  const searchTerm = `/${modifiedTransaction}/`.replaceAll(/\/+/g, '/');
  return searchTerm;
}
