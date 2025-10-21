import {createContext, useCallback, useContext, useMemo, useRef} from 'react';
import debounce from 'lodash/debounce';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type BatchContextType = {
  batchUrlParamUpdates: (updates: Record<string, string | string[] | undefined>) => void;
  flushUpdates: () => void;
};

const BatchContext = createContext<BatchContextType | null>(null);

export function UrlParamBatchProvider({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Store the pending updates in a `ref` so that queuing updates doesn't cause a
  // context re-render.
  const pendingUpdates = useRef<Record<string, string | string[] | undefined>>({});

  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdates.current).length === 0) {
      return;
    }

    navigate(
      {
        ...location,
        query: {
          ...location.query,
          ...pendingUpdates.current,
        },
      },

      // TODO: Use replace until we can sync the state of the widget
      // when the user navigates back
      {replace: true, preventScrollReset: true}
    );
    pendingUpdates.current = {};
  }, [location, navigate]);

  // Debounced URL updater function
  const updateURL = useMemo(
    () =>
      debounce(() => {
        // Flush all current pending URL query parameter updates
        flushUpdates();
      }, DEFAULT_DEBOUNCE_DURATION),
    [flushUpdates]
  );

  const batchUrlParamUpdates = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      // Immediate update the pending URL query parameter updates
      pendingUpdates.current = {
        ...pendingUpdates.current,
        ...updates,
      };

      // Immediately calls the debounced URL updater function
      updateURL();
    },
    [updateURL]
  );

  return (
    <BatchContext value={{batchUrlParamUpdates, flushUpdates}}>{children}</BatchContext>
  );
}

export const useUrlBatchContext = () => {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error('useUrlBatchContext must be used within a UrlParamBatchProvider');
  }
  return context;
};
