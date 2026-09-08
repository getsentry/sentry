import {useState} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {
  getDatasetConfig,
  type SearchBarData,
} from 'sentry/views/dashboards/datasetConfig/base';
import {useGlobalFilterTraceMetricsSearchBarDataProvider} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {WidgetType} from 'sentry/views/dashboards/types';

type FilterKeySearch = {
  query: string;
  widgetType: WidgetType;
};

export function useDatasetSearchBarData(): {
  getSearchBarData: (widgetType: WidgetType) => SearchBarData;
  onFilterKeySearch: (widgetType: WidgetType, query: string) => void;
} {
  const {selection} = usePageFilters();
  const [filterKeySearch, setFilterKeySearch] = useState<FilterKeySearch | null>(null);
  const [debouncedFilterKeySearch] = useDebouncedValue(filterKeySearch, {
    wait: DEFAULT_DEBOUNCE_DURATION,
  });

  const getFilterKeySearch = (widgetType: WidgetType) =>
    debouncedFilterKeySearch?.widgetType === widgetType
      ? debouncedFilterKeySearch.query
      : undefined;

  const errorsData = getDatasetConfig(WidgetType.ERRORS).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const logsData = getDatasetConfig(WidgetType.LOGS).useSearchBarDataProvider!({
    filterKeySearch: getFilterKeySearch(WidgetType.LOGS),
    pageFilters: selection,
  });

  const spansData = getDatasetConfig(WidgetType.SPANS).useSearchBarDataProvider!({
    filterKeySearch: getFilterKeySearch(WidgetType.SPANS),
    pageFilters: selection,
  });

  const issuesData = getDatasetConfig(WidgetType.ISSUE).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const releasesData = getDatasetConfig(WidgetType.RELEASE).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const traceMetricsData = useGlobalFilterTraceMetricsSearchBarDataProvider({
    filterKeySearch: getFilterKeySearch(WidgetType.TRACEMETRICS),
    pageFilters: selection,
  });

  const getSearchBarData = (widgetType: WidgetType): SearchBarData => {
    switch (widgetType) {
      case WidgetType.ERRORS:
        return errorsData;
      case WidgetType.LOGS:
        return logsData;
      case WidgetType.SPANS:
        return spansData;
      case WidgetType.ISSUE:
        return issuesData;
      case WidgetType.RELEASE:
        return releasesData;
      case WidgetType.TRACEMETRICS:
        return traceMetricsData;
      default:
        return {
          getFilterKeySections: () => [],
          getFilterKeys: () => ({}),
          getTagValues: () => Promise.resolve([]),
        };
    }
  };

  return {
    getSearchBarData,
    onFilterKeySearch: (widgetType, query) => {
      setFilterKeySearch({query, widgetType});
    },
  };
}
