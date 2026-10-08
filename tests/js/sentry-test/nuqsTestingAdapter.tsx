import {createContext, use, useCallback, type ReactElement, type ReactNode} from 'react';
import {UNSAFE_DataRouterContext} from 'react-router';
import {
  unstable_createAdapterProvider as createAdapterProvider,
  renderQueryString,
} from 'nuqs/adapters/custom';
import type {unstable_AdapterInterface as AdapterInterface} from 'nuqs/adapters/custom';
import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

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

function useSentryAdapter(): AdapterInterface {
  const routerContext = use(UNSAFE_DataRouterContext);
  if (!routerContext) {
    throw new Error('SentryNuqsTestingAdapter requires a data router');
  }
  const {router} = routerContext;
  const onUrlUpdate = use(UrlUpdateContext);
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);

  const updateUrl = useCallback<AdapterInterface['updateUrl']>(
    (search, options) => {
      const queryString = renderQueryString(search);
      onUrlUpdate?.({
        searchParams: new URLSearchParams(search),
        queryString,
        options,
      });

      navigate(`${router.state.location.pathname}${queryString}`, {
        replace: options.history === 'replace',
      });
    },
    [navigate, onUrlUpdate, router]
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
    autoResetQueueOnUpdate: true,
  };
}

const AdapterProvider = createAdapterProvider(useSentryAdapter);

/**
 * Read rendered query state from useLocation and compose queued writes onto
 * the data router's current location. Keep the provider stable across rerenders.
 */
export function SentryNuqsTestingAdapter({
  children,
  defaultOptions,
  onUrlUpdate,
}: SentryNuqsTestingAdapterProps): ReactElement {
  return (
    <UrlUpdateContext value={onUrlUpdate}>
      <AdapterProvider defaultOptions={defaultOptions}>{children}</AdapterProvider>
    </UrlUpdateContext>
  );
}
