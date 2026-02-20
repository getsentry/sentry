import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {
  getDatasetConfig,
  type SearchBarData,
} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType} from 'sentry/views/dashboards/types';

export function useDatasetSearchBarData(): (widgetType: WidgetType) => SearchBarData {
  const {selection} = usePageFilters();

  const errorsData = getDatasetConfig(WidgetType.ERRORS).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const logsData = getDatasetConfig(WidgetType.LOGS).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const spansData = getDatasetConfig(WidgetType.SPANS).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const issuesData = getDatasetConfig(WidgetType.ISSUE).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const releasesData = getDatasetConfig(WidgetType.RELEASE).useSearchBarDataProvider!({
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
      default:
        return {
          getFilterKeySections: () => [],
          getFilterKeys: () => ({}),
          getTagValues: () => Promise.resolve([]),
        };
    }
  };

  return getSearchBarData;
}
