import {useCallback, useMemo, type ReactElement, type ReactNode} from 'react';
import {unstable_createAdapterProvider as createAdapterProvider} from 'nuqs/adapters/custom';
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

/**
 * Custom nuqs adapter component for Sentry that reads location from our
 * useLocation hook instead of maintaining its own internal state.
 *
 * This ensures nuqs uses the same location source as the rest of the
 * application during tests.
 */
export function SentryNuqsTestingAdapter({
  children,
  defaultOptions,
  onUrlUpdate,
}: SentryNuqsTestingAdapterProps): ReactElement {
  // Create a hook that nuqs will call to get the adapter interface
  // This hook needs to be defined inside a component that has access to location/navigate
  const useSentryAdapter = useCallback(
    (_watchKeys: string[]): AdapterInterface => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const location = useLocation();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const navigate = useNavigate();

      // Get search params from the current location
      const searchParams = new URLSearchParams(location.search || '');

      const updateUrl: AdapterInterface['updateUrl'] = (search, options) => {
        const newSearchParams = new URLSearchParams(search);
        const queryString = newSearchParams.toString();

        // Call the onUrlUpdate callback if provided
        onUrlUpdate?.({
          searchParams: new URLSearchParams(search), // make a copy
          queryString,
          options,
        });

        // Navigate to the new location using Sentry's navigate
        // We need to construct the full path with the search string
        const newPath = queryString
          ? `${location.pathname}?${queryString}`
          : location.pathname;

        // The navigate function from TestRouter already wraps this in act()
        console.log({newPath});
        navigate(newPath, {replace: options.history === 'replace'});
      };

      const getSearchParamsSnapshot = () => {
        // Always read from the current location
        return new URLSearchParams(location.search || '');
      };

      return {
        searchParams,
        updateUrl,
        getSearchParamsSnapshot,
        rateLimitFactor: 0, // No throttling in tests
        autoResetQueueOnUpdate: true, // Reset update queue after each update
      };
    },
    [onUrlUpdate]
  );

  // Create the adapter provider (memoized to prevent remounting)
  const AdapterProvider = useMemo(
    () => createAdapterProvider(useSentryAdapter),
    [useSentryAdapter]
  );

  return <AdapterProvider defaultOptions={defaultOptions}>{children}</AdapterProvider>;
}

/**
 * A higher order component that wraps children with the SentryNuqsTestingAdapter
 *
 * Usage:
 * ```tsx
 * render(<MyComponent />, {
 *   wrapper: withSentryNuqsTestingAdapter({ onUrlUpdate: spy })
 * })
 * ```
 */
export function withSentryNuqsTestingAdapter(
  props: Omit<SentryNuqsTestingAdapterProps, 'children'> = {}
) {
  return function SentryNuqsTestingAdapterWrapper({
    children,
  }: {
    children: ReactNode;
  }): ReactElement {
    return <SentryNuqsTestingAdapter {...props}>{children}</SentryNuqsTestingAdapter>;
  };
}
