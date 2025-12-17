import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getDatasetConfig,
  type SearchBarData,
} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType} from 'sentry/views/dashboards/types';

export function useDatasetSearchBarData(): (widgetType: WidgetType) => SearchBarData {
  const {selection} = usePageFilters();

  const getSearchBarData = (widgetType: WidgetType): SearchBarData => {
    const datasetConfig = getDatasetConfig(widgetType);
    if (datasetConfig.useSearchBarDataProvider) {
      return datasetConfig.useSearchBarDataProvider({
        pageFilters: selection,
      });
    }

    return {
      getFilterKeySections: () => [],
      getFilterKeys: () => ({}),
      getTagValues: () => Promise.resolve([]),
    };
  };

  return getSearchBarData;
}
