import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetricsResultsMetaMapKey} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMetricsResultsMeta} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OnDemandControlConsumer} from 'sentry/utils/performance/contexts/onDemandControl';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  WidgetType,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import type {WidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import {useDashboardsMEPContext} from './dashboardsMEPContext';
import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => React.JSX.Element;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  queue?: WidgetQueryQueue;
};

function WidgetQueries({
  api,
  queue,
  children,
  organization,
  selection,
  widget,
  dashboardFilters,
  cursor,
  limit,
  onDataFetched,
  onWidgetSplitDecision,
  onDataFetchStart,
}: Props) {
  const config = getDatasetConfig(
    widget.widgetType as
      | WidgetType.DISCOVER
      | WidgetType.ERRORS
      | WidgetType.TRANSACTIONS
      | WidgetType.MOBILE_APP_SIZE
  );
  const context = useDashboardsMEPContext();
  const metricsMeta = useMetricsResultsMeta();
  const mepSettingContext = useMEPSettingContext();

  let setIsMetricsData: undefined | ((value?: boolean) => void);
  let setIsMetricsExtractedData:
    | undefined
    | ((mapKey: MetricsResultsMetaMapKey, value?: boolean) => void);

  if (context) {
    setIsMetricsData = context.setIsMetricsData;
  }
  if (metricsMeta) {
    setIsMetricsExtractedData = metricsMeta.setIsMetricsExtractedData;
  }

  const isSeriesMetricsDataResults: boolean[] = [];
  const isSeriesMetricsExtractedDataResults: Array<boolean | undefined> = [];
  const afterFetchSeriesData = (rawResults: SeriesResult) => {
    if (rawResults.data) {
      rawResults = rawResults as EventsStats;
      if (rawResults.isMetricsData !== undefined) {
        isSeriesMetricsDataResults.push(rawResults.isMetricsData);
      }
      if (rawResults.isMetricsExtractedData !== undefined) {
        isSeriesMetricsExtractedDataResults.push(rawResults.isMetricsExtractedData);
      }
      isSeriesMetricsExtractedDataResults.push(
        rawResults.isMetricsExtractedData || rawResults.meta?.isMetricsExtractedData
      );
    } else {
      Object.keys(rawResults).forEach(key => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const rawResult: EventsStats = rawResults[key];
        if (rawResult.isMetricsData !== undefined) {
          isSeriesMetricsDataResults.push(rawResult.isMetricsData);
        }
        if (
          (rawResult.isMetricsExtractedData || rawResult.meta?.isMetricsExtractedData) !==
          undefined
        ) {
          isSeriesMetricsExtractedDataResults.push(
            rawResult.isMetricsExtractedData || rawResult.meta?.isMetricsExtractedData
          );
        }
      });
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isSeriesMetricsDataResults.includes(false));
    setIsMetricsExtractedData?.(
      widget,
      isSeriesMetricsExtractedDataResults.every(Boolean) &&
        isSeriesMetricsExtractedDataResults.some(Boolean)
    );

    const resultValues = Object.values(rawResults);
    let splitDecision: WidgetType | undefined = undefined;
    if (rawResults.meta) {
      splitDecision = (rawResults.meta as EventsStats['meta'])?.discoverSplitDecision;
    } else if (Object.values(rawResults).length > 0) {
      // Multi-series queries will have a meta key on each series
      // We can just read the decision from one.
      splitDecision = resultValues[0]?.meta?.discoverSplitDecision;
    }

    if (splitDecision) {
      // Update the dashboard state with the split decision
      onWidgetSplitDecision?.(splitDecision);
    }
  };

  const isTableMetricsDataResults: boolean[] = [];
  const isTableMetricsExtractedDataResults: boolean[] = [];
  const afterFetchTableData = (rawResults: TableResult) => {
    if (rawResults.meta?.isMetricsData !== undefined) {
      isTableMetricsDataResults.push(rawResults.meta.isMetricsData);
    }
    if (rawResults.meta?.isMetricsExtractedData !== undefined) {
      isTableMetricsExtractedDataResults.push(rawResults.meta.isMetricsExtractedData);
    }
    // If one of the queries is sampled, then mark the whole thing as sampled
    setIsMetricsData?.(!isTableMetricsDataResults.includes(false));
    setIsMetricsExtractedData?.(
      widget,
      isTableMetricsExtractedDataResults.every(Boolean) &&
        isTableMetricsExtractedDataResults.some(Boolean)
    );

    if (
      [WidgetType.ERRORS, WidgetType.TRANSACTIONS].includes(
        rawResults?.meta?.discoverSplitDecision
      )
    ) {
      // Update the dashboard state with the split decision
      onWidgetSplitDecision?.(rawResults?.meta?.discoverSplitDecision);
    }
  };

  return (
    <OnDemandControlConsumer>
      {OnDemandControlContext => (
        <GenericWidgetQueries<SeriesResult, TableResult>
          queue={queue}
          config={config}
          api={api}
          organization={organization}
          selection={selection}
          widget={widget}
          samplingMode={
            widget.widgetType === WidgetType.SPANS ? SAMPLING_MODE.NORMAL : undefined
          }
          cursor={cursor}
          limit={limit}
          dashboardFilters={dashboardFilters}
          onDataFetched={onDataFetched}
          onDataFetchStart={onDataFetchStart}
          afterFetchSeriesData={afterFetchSeriesData}
          afterFetchTableData={afterFetchTableData}
          mepSetting={mepSettingContext.metricSettingState}
          onDemandControlContext={OnDemandControlContext}
          {...OnDemandControlContext}
        >
          {children}
        </GenericWidgetQueries>
      )}
    </OnDemandControlConsumer>
  );
}

export default WidgetQueries;
