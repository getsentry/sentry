import {debounce} from 'lodash';
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from 'react';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type BatchContextType = {
  batchUpdates: (updates: Record<string, string | undefined>) => void;
  flushUpdates: () => void;
};

const BatchContext = createContext<BatchContextType | null>(null);

export function UrlBatchProvider({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingUpdates, setPendingUpdates] = useState<
    Record<string, string | undefined>
  >({});

  const batchUpdates = useCallback((updates: Record<string, string | undefined>) => {
    setPendingUpdates(current => ({...current, ...updates}));
  }, []);

  const flushUpdates = useCallback(() => {
    if (Object.keys(pendingUpdates).length === 0) {
      return;
    }

    navigate({
      ...location,
      query: {
        ...location.query,
        ...pendingUpdates,
      },
    });
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
    <BatchContext.Provider value={{batchUpdates, flushUpdates}}>
      {children}
    </BatchContext.Provider>
  );
}

export const useUrlBatch = () => {
  const context = useContext(BatchContext);
  if (!context) {
    throw new Error('useUrlBatch must be used within a UrlBatchProvider');
  }
  return context;
};
