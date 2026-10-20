import {Fragment} from 'react';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {IngestionMeta} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {widgetFetchesOwnData} from 'sentry/views/dashboards/utils';
import {shouldForceQueryToSpans} from 'sentry/views/dashboards/utils/shouldForceQueryToSpans';
import type {WidgetTimeSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import type {OnDataFetchedProps} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {SpansWidgetQueries} from 'sentry/views/dashboards/widgetCard/spansWidgetQueries';
import {TraceMetricsWidgetQueries} from 'sentry/views/dashboards/widgetCard/traceMetricsWidgetQueries';
import {transformWidgetSeriesToTimeSeries} from 'sentry/views/dashboards/widgetCard/transformWidgetSeriesToTimeSeries';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';

import {IssueWidgetQueries} from './issueWidgetQueries';
import {LogsWidgetQueries} from './logsWidgetQueries';
import {MobileAppSizeWidgetQueries} from './mobileAppSizeWidgetQueries';
import {ReleaseWidgetQueries} from './releaseWidgetQueries';
import {WidgetQueries} from './widgetQueries';

type Results = {
  loading: boolean;
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  errorMessage?: string;
  heatmapResults?: HeatMapSeries;
  ingestion?: IngestionMeta;
  isProgressivelyLoading?: boolean;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesInterval?: string;
  timeseriesResults?: WidgetTimeSeries[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalIssuesCount?: string;
};

type HookResults = Omit<Results, 'timeseriesResults'> & {
  timeseriesResults?: Array<Series | WidgetTimeSeries>;
};

function isWidgetTimeSeries(
  series: Series | WidgetTimeSeries
): series is WidgetTimeSeries {
  return 'queryIndex' in series;
}

// TODO: Remove once the widget query hooks return WidgetTimeSeries themselves
function toWidgetTimeSeries(
  widget: Widget,
  {
    timeseriesResults,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
  }: Pick<
    HookResults,
    'timeseriesResults' | 'timeseriesResultsTypes' | 'timeseriesResultsUnits'
  >
): WidgetTimeSeries[] | undefined {
  return timeseriesResults
    ?.map(series => {
      if (isWidgetTimeSeries(series)) {
        return series;
      }
      const transformed = transformWidgetSeriesToTimeSeries(
        series,
        widget,
        timeseriesResultsTypes,
        timeseriesResultsUnits
      );
      if (!transformed) {
        return null;
      }
      const {timeSeries, seriesName, widgetQuery} = transformed;
      return {
        queryIndex: widget.queries.indexOf(widgetQuery),
        widgetQuery,
        seriesName,
        timeSeries,
      };
    })
    .filter(defined);
}

type Props = {
  children: (props: Results) => React.ReactNode;
  selection: PageFilters;
  widget: Widget;
  dashboardFilters?: DashboardFilters;
  onDataFetchStart?: () => void;
  onDataFetched?: (
    results: Pick<
      Results,
      | 'pageLinks'
      | 'tableResults'
      | 'timeseriesResults'
      | 'timeseriesResultsTypes'
      | 'timeseriesResultsUnits'
      | 'totalIssuesCount'
      | 'confidence'
      | 'dataScanned'
      | 'isSampled'
      | 'sampleCount'
    >
  ) => void;
  tableItemLimit?: number;
  widgetInterval?: string;
  // Number of buckets for a non-time axis. Used by heat maps for the Y-axis
  // bucket count, derived from the rendered chart height.
  yBuckets?: number;
};

export function WidgetCardDataLoader({
  children,
  widget,
  selection,
  dashboardFilters,
  tableItemLimit,
  onDataFetched,
  onDataFetchStart,
  widgetInterval,
  yBuckets,
}: Props) {
  const render = (results: HookResults) =>
    children({...results, timeseriesResults: toWidgetTimeSeries(widget, results)});
  const handleDataFetched = onDataFetched
    ? (results: OnDataFetchedProps) =>
        onDataFetched({
          ...results,
          timeseriesResults: toWidgetTimeSeries(widget, results),
        })
    : undefined;

  if (widgetFetchesOwnData(widget.displayType)) {
    return render({loading: false});
  }

  if (widget.widgetType === WidgetType.ISSUE) {
    return (
      <IssueWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={handleDataFetched}
        dashboardFilters={dashboardFilters}
        onDataFetchStart={onDataFetchStart}
        widgetInterval={widgetInterval}
      >
        {({
          tableResults,
          timeseriesResults,
          timeseriesResultsTypes,
          errorMessage,
          loading,
        }) => (
          <Fragment>
            {render({
              tableResults,
              timeseriesResults,
              timeseriesResultsTypes,
              errorMessage,
              loading,
            })}
          </Fragment>
        )}
      </IssueWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.RELEASE) {
    return (
      <ReleaseWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={handleDataFetched}
        dashboardFilters={dashboardFilters}
        onDataFetchStart={onDataFetchStart}
        widgetInterval={widgetInterval}
      >
        {({
          tableResults,
          timeseriesResults,
          timeseriesInterval,
          errorMessage,
          loading,
        }) => (
          <Fragment>
            {render({
              tableResults,
              timeseriesResults,
              timeseriesInterval,
              errorMessage,
              loading,
            })}
          </Fragment>
        )}
      </ReleaseWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.SPANS || shouldForceQueryToSpans(widget)) {
    return (
      <SpansWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetched={handleDataFetched}
        dashboardFilters={dashboardFilters}
        onDataFetchStart={onDataFetchStart}
        widgetInterval={widgetInterval}
      >
        {props => <Fragment>{render({...props})}</Fragment>}
      </SpansWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.TRACEMETRICS) {
    return (
      <TraceMetricsWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetchStart={onDataFetchStart}
        onDataFetched={handleDataFetched}
        dashboardFilters={dashboardFilters}
        widgetInterval={widgetInterval}
        yBuckets={yBuckets}
      >
        {props => <Fragment>{render({...props})}</Fragment>}
      </TraceMetricsWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.LOGS) {
    return (
      <LogsWidgetQueries
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
        onDataFetchStart={onDataFetchStart}
        onDataFetched={handleDataFetched}
        dashboardFilters={dashboardFilters}
        widgetInterval={widgetInterval}
      >
        {props => <Fragment>{render({...props})}</Fragment>}
      </LogsWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.PREPROD_APP_SIZE) {
    return (
      <MobileAppSizeWidgetQueries
        widget={widget}
        selection={selection}
        dashboardFilters={dashboardFilters}
        widgetInterval={widgetInterval}
      >
        {props => <Fragment>{render({...props})}</Fragment>}
      </MobileAppSizeWidgetQueries>
    );
  }

  return (
    <WidgetQueries
      widget={widget}
      selection={selection}
      limit={tableItemLimit}
      onDataFetched={handleDataFetched}
      onDataFetchStart={onDataFetchStart}
      dashboardFilters={dashboardFilters}
      widgetInterval={widgetInterval}
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        confidence,
        ingestion,
      }) => (
        <Fragment>
          {render({
            tableResults,
            timeseriesResults,
            errorMessage,
            loading,
            timeseriesResultsTypes,
            timeseriesResultsUnits,
            confidence,
            ingestion,
          })}
        </Fragment>
      )}
    </WidgetQueries>
  );
}
