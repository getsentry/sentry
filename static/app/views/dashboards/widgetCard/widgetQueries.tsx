import type {PageFilters} from 'sentry/types/core';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  WidgetType,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import {useDashboardsMEPContext} from './dashboardsMEPContext';
import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import {useGenericWidgetQueries} from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

type Props = {
  children: (props: GenericWidgetQueriesResult) => React.JSX.Element;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  // Optional selection override for widget viewer modal zoom functionality
  selection?: PageFilters;
  widgetInterval?: string;
};

function WidgetQueriesWithConfig({
  children,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onDataFetchStart,
  selection,
  config,
  afterFetchSeriesData,
  afterFetchTableData,
  mepSettingContext,
  widgetInterval,
}: Props & {
  afterFetchSeriesData: (rawResults: SeriesResult) => void;
  afterFetchTableData: (rawResults: TableResult) => void;
  config: any;
  mepSettingContext: ReturnType<typeof useMEPSettingContext>;
}) {
  const props = useGenericWidgetQueries<SeriesResult, TableResult>({
    config,
    widget,
    samplingMode:
      widget.widgetType === WidgetType.SPANS ? SAMPLING_MODE.NORMAL : undefined,
    cursor,
    limit,
    dashboardFilters,
    onDataFetched,
    onDataFetchStart,
    selection,
    afterFetchSeriesData,
    afterFetchTableData,
    mepSetting: mepSettingContext.metricSettingState,
    widgetInterval,
  });

  return children(props);
}

export function WidgetQueries({
  children,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onDataFetchStart,
  selection,
  widgetInterval,
}: Props) {
  // Errors and Transactions datasets are the only datasets processed in this component.
  const config = getDatasetConfig(widget.widgetType);
  const context = useDashboardsMEPContext();
  const mepSettingContext = useMEPSettingContext();

  let setIsMetricsData: undefined | ((value?: boolean) => void);

  if (context) {
    setIsMetricsData = context.setIsMetricsData;
  }
  const isSeriesMetricsDataResults: boolean[] = [];
  const afterFetchSeriesData = (rawResults: SeriesResult) => {
    if (rawResults.data) {
      rawResults = rawResults as EventsStats;
      if (rawResults.isMetricsData !== undefined) {
        // oxlint-disable-next-line react/immutability
        isSeriesMetricsDataResults.push(rawResults.isMetricsData);
      }
    } else {
      Object.keys(rawResults).forEach(key => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const rawResult: EventsStats = rawResults[key];
        if (rawResult.isMetricsData !== undefined) {
          isSeriesMetricsDataResults.push(rawResult.isMetricsData);
        }
      });
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isSeriesMetricsDataResults.includes(false));
  };

  const isTableMetricsDataResults: boolean[] = [];
  const afterFetchTableData = (rawResults: TableResult) => {
    if (rawResults.meta?.isMetricsData !== undefined) {
      // oxlint-disable-next-line react/immutability
      isTableMetricsDataResults.push(rawResults.meta.isMetricsData);
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isTableMetricsDataResults.includes(false));
  };

  return (
    <WidgetQueriesWithConfig
      widget={widget}
      dashboardFilters={dashboardFilters}
      cursor={cursor}
      limit={limit}
      onDataFetched={onDataFetched}
      onDataFetchStart={onDataFetchStart}
      selection={selection}
      config={config}
      afterFetchSeriesData={afterFetchSeriesData}
      afterFetchTableData={afterFetchTableData}
      mepSettingContext={mepSettingContext}
      widgetInterval={widgetInterval}
    >
      {children}
    </WidgetQueriesWithConfig>
  );
}
