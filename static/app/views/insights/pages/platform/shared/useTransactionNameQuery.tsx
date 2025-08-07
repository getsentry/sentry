import {useCallback} from 'react';

import {escapeDoubleQuotes} from 'sentry/utils';
import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';

function prefixWithTransaction(query: string) {
  return `transaction:"${escapeDoubleQuotes(query)}"`;
}

export function useTransactionNameQuery() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(location, withStaticFilters);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      navigate({
        pathname: location.pathname,
        query: {
          ...location.query,
          query: searchQuery.trim() || undefined,
        },
      });
    },
    [location, navigate]
  );

  const setTransactionFilter = useCallback(
    (value: string) => {
      handleSearch(prefixWithTransaction(value));
    },
    [handleSearch]
  );

  const derivedQuery = eventView.query;

  return {
    query: derivedQuery,
    eventView,
    handleSearch,
    setTransactionFilter,
  };
}
