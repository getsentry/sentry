import {createContext, useCallback, useContext, useEffect, useMemo, useRef} from 'react';
import debounce from 'lodash/debounce';
import * as qs from 'query-string';

import {useNavigate} from 'sentry/utils/useNavigate';

type BatchContextType = {
  batchUrlParamUpdates: (updates: Record<string, string | string[] | undefined>) => void;
  flushUpdates: () => void;
};

const BatchContext = createContext<BatchContextType | null>(null);

export function UrlParamBatchProvider({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();

  // Store the pending updates in a `ref`. This way, queuing more updates
  // doesn't update any state, so the context doesn't re-render and cause a
  // re-render of all its subscribers.
  const pendingUpdates = useRef<Record<string, string | string[] | undefined>>({});

  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdates.current).length === 0) {
      return;
    }

    navigate(
      {
        pathname: window.location.pathname,
        query: {
          ...qs.parse(window.location.search),
          ...pendingUpdates.current,
        },
      },

      // TODO: Use replace until we can sync the state of the widget
      // when the user navigates back
      {replace: true, preventScrollReset: true}
    );
    pendingUpdates.current = {};
  }, [navigate]);

  // Debounced URL updater function
  const updateURL = useMemo(
    () =>
      debounce(() => {
        // Flush all current pending URL query parameter updates
        flushUpdates();
      }, URL_UPDATE_DEBOUNCE),
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

  // Cancel pending changes during `useEffect` cleanup. All the dependencies are
  // fairly stable, so this should _only_ happen on unmount. It's important to
  // run this on unmount rather than on location change because this context
  // might be mounted low in the tree, and might actually get unmounted during a
  // location change it should be listening to.
  useEffect(() => {
    return () => {
      updateURL.cancel();
      pendingUpdates.current = {};
    };
  }, [updateURL]);

  return (
    <BatchContext.Provider value={{batchUrlParamUpdates, flushUpdates}}>
      {children}
    </BatchContext.Provider>
  );
}

export const useUrlBatchContext = () => {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error('useUrlBatchContext must be used within a UrlParamBatchProvider');
  }
  return context;
};

const URL_UPDATE_DEBOUNCE = 300;
