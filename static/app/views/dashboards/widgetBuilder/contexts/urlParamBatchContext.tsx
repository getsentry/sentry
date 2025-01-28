import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  const [pendingUpdates, setPendingUpdates] = useState<
    Record<string, string | string[] | undefined>
  >({});

  const batchUrlParamUpdates = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      setPendingUpdates(current => ({...current, ...updates}));
    },
    []
  );

  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdates).length === 0) {
      return;
    }
    navigate(
      {
        ...location,
        query: {
          ...location.query,
          ...pendingUpdates,
        },
      },

      // TODO: Use replace until we can sync the state of the widget
      // when the user navigates back
      {replace: true}
    );
    setPendingUpdates({});
  }, [location, navigate, pendingUpdates]);

  // Debounce URL updates
  const updateURL = useMemo(
    () =>
      debounce(() => {
        flushUpdates();
      }, DEFAULT_DEBOUNCE_DURATION),
    [flushUpdates]
  );

  // Trigger the URL updates
  useEffect(() => {
    updateURL();
    return () => updateURL.cancel();
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
