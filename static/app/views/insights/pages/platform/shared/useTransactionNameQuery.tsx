import {useCallback} from 'react';

import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {generateBackendPerformanceEventView} from 'sentry/views/performance/data';
import {getTransactionSearchQuery} from 'sentry/views/performance/utils';

function prefixWithTransaction(query: string) {
  return `transaction:"${query}"`;
}

export function useTransactionNameQuery() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const withStaticFilters = canUseMetricsData(organization);
  const eventView = generateBackendPerformanceEventView(location, withStaticFilters);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      let newQuery = searchQuery.trim();

      // The search input submits raw text if the user does not select a transaction
      // from the dropdown.
      if (newQuery && !newQuery.startsWith('transaction:"')) {
        newQuery = prefixWithTransaction(searchQuery);
      }

      navigate({
        pathname: location.pathname,
        query: {
          ...location.query,
          query: newQuery || undefined,
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

  const derivedQuery = getTransactionSearchQuery(location, eventView.query);

  return {
    query: derivedQuery,
    eventView,
    handleSearch,
    setTransactionFilter,
  };
}
