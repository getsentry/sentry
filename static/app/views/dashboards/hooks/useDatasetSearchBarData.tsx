import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getDatasetConfig,
  type SearchBarData,
} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType} from 'sentry/views/dashboards/types';

export type DatasetSearchBarData = {
  [WidgetType.ERRORS]: SearchBarData;
  [WidgetType.LOGS]: SearchBarData;
  [WidgetType.SPANS]: SearchBarData;
  [WidgetType.ISSUE]: SearchBarData;
  [WidgetType.RELEASE]: SearchBarData;
};

export function useDatasetSearchBarData(): DatasetSearchBarData {
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

  return {
    [WidgetType.ERRORS]: errorsData,
    [WidgetType.LOGS]: logsData,
    [WidgetType.SPANS]: spansData,
    [WidgetType.ISSUE]: issuesData,
    [WidgetType.RELEASE]: releasesData,
  };
}
