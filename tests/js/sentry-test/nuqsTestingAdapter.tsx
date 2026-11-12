import {createContext, use, useCallback, type ReactElement, type ReactNode} from 'react';
import {UNSAFE_DataRouterContext, type DataRouter} from 'react-router';
import {
  unstable_createAdapterProvider as createAdapterProvider,
  renderQueryString,
} from 'nuqs/adapters/custom';
import type {unstable_AdapterInterface as AdapterInterface} from 'nuqs/adapters/custom';
import {NuqsTestingAdapter, type OnUrlUpdateFunction} from 'nuqs/adapters/testing';

import {useLocation} from 'sentry/utils/useLocation';

type SentryNuqsTestingAdapterProps = {
  children: ReactNode;
  /**
   * Default options to pass to nuqs
   */
  defaultOptions?: {
    clearOnDefault?: boolean;
    scroll?: boolean;
    shallow?: boolean;
  };
  /**
   * A function that will be called whenever the URL is updated.
   * Connect that to a spy in your tests to assert the URL updates.
   */
  onUrlUpdate?: OnUrlUpdateFunction;
};

const UrlUpdateContext = createContext<OnUrlUpdateFunction | undefined>(undefined);

// Stands in for production's retained queue: serve a write's URL until the router leaves it.
const writtenLocationKeys = new WeakMap<DataRouter, string>();

function useSentryAdapter(): AdapterInterface {
  const routerContext = use(UNSAFE_DataRouterContext);
  if (!routerContext) {
    throw new Error('SentryNuqsTestingAdapter requires a data router');
  }
  const {router} = routerContext;
  const onUrlUpdate = use(UrlUpdateContext);
  const location = useLocation();
  const searchParams = new URLSearchParams(
    router.state.historyAction !== 'POP' &&
      router.state.location.key === writtenLocationKeys.get(router)
      ? router.state.location.search
      : location.search
  );

  const updateUrl = useCallback<AdapterInterface['updateUrl']>(
    (search, options) => {
      const queryString = renderQueryString(search);
      onUrlUpdate?.({
        searchParams: new URLSearchParams(search),
        queryString,
        options,
      });

      const current = router.state.location;
      const navigation = router.navigate(
        {pathname: current.pathname, search: queryString, hash: current.hash},
        {replace: options.history === 'replace', state: current.state}
      );
      writtenLocationKeys.set(router, router.state.location.key);
      return navigation;
    },
    [onUrlUpdate, router]
  );

  // A queued write can follow navigation before React renders the new
  // location. Compose onto router state so that earlier writes are retained.
  const getSearchParamsSnapshot = useCallback(
    () => new URLSearchParams(router.state.location.search),
    [router]
  );

  return {
    searchParams,
    updateUrl,
    getSearchParamsSnapshot,
    rateLimitFactor: 0,
    // Production resets the queue on window.history changes, which the memory router never makes.
    autoResetQueueOnUpdate: true,
  };
}

const AdapterProvider = createAdapterProvider(useSentryAdapter);

export function SentryNuqsTestingAdapter({
  children,
  defaultOptions,
  onUrlUpdate,
}: SentryNuqsTestingAdapterProps): ReactElement {
  return (
    // nuqs keeps its URL update queue in a global, and only its own testing
    // adapter clears it on mount, so a previous test's pending write would
    // otherwise become this test's initial state. The inner provider overrides
    // its adapter.
    <NuqsTestingAdapter>
      <UrlUpdateContext value={onUrlUpdate}>
        <AdapterProvider defaultOptions={defaultOptions}>{children}</AdapterProvider>
      </UrlUpdateContext>
    </NuqsTestingAdapter>
  );
}
