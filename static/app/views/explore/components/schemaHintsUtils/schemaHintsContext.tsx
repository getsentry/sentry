import {createContext, useContext, useMemo} from 'react';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  LogsPageParamsProvider,
  useLogsSearch,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  PageParamsProvider,
  useExploreQuery,
  useSetExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';

export type QuerySource = 'explore' | 'logs';

type SchemaHintsContextValue = {
  exploreQuery: string;
  setExploreQuery: (query: any) => void;
};

const SchemaHintsContext = createContext<SchemaHintsContextValue | null>(null);

interface SchemaHintsProviderProps {
  children: React.ReactNode;
  source: QuerySource;
}

function InnerSchemaHintsProvider({
  children,
  source = 'explore',
}: SchemaHintsProviderProps) {
  const exploreQuery = useExploreQuery();
  const logsSearchHook = useLogsSearch();
  const setExploreQuery = useSetExploreQuery();
  const setLogsQuery = useSetLogsSearch();

  const value = useMemo(() => {
    let query;
    let setQuery;
    switch (source) {
      case 'logs':
        query = logsSearchHook.formatString();
        setQuery = (logsQuery: string) => setLogsQuery(new MutableSearch(logsQuery));
        break;
      case 'explore':
        query = exploreQuery;
        setQuery = setExploreQuery;
        break;
      default:
        query = exploreQuery;
        setQuery = setExploreQuery;
    }

    return {
      exploreQuery: query,
      setExploreQuery: setQuery,
    };
  }, [source, logsSearchHook, exploreQuery, setExploreQuery, setLogsQuery]);

  return (
    <SchemaHintsContext.Provider value={value}>{children}</SchemaHintsContext.Provider>
  );
}

export function SchemaHintsProvider({children, source}: SchemaHintsProviderProps) {
  return (
    <PageParamsProvider>
      <LogsPageParamsProvider analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}>
        <InnerSchemaHintsProvider source={source}>{children}</InnerSchemaHintsProvider>
      </LogsPageParamsProvider>
    </PageParamsProvider>
  );
}

export function useSchemaHintsQueryHooks() {
  const context = useContext(SchemaHintsContext);
  if (!context) {
    throw new Error('useSchemaHints must be used within a SchemaHintsProvider');
  }
  return context;
}
