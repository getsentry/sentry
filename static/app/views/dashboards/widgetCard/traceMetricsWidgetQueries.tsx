import {useCallback, useState} from 'react';

import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Confidence} from 'sentry/types/organization';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import useOrganization from 'sentry/utils/useOrganization';
import {
  EMPTY_METRIC_SELECTION,
  TraceMetricsConfig,
} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import type {WidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

type SeriesResult = EventsTimeSeriesResponse;
type TableResult = EventsTableData;

type TraceMetricsWidgetQueriesProps = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => React.JSX.Element;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onBestEffortDataFetched?: () => void;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: OnDataFetchedProps) => void;
  queue?: WidgetQueryQueue;
};

type TraceMetricsWidgetQueriesImplProps = TraceMetricsWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
    seriesIsSampled: boolean | null;
    seriesSampleCount: number | undefined;
  };
};

function TraceMetricsWidgetQueries(props: TraceMetricsWidgetQueriesProps) {
  const getConfidenceInformation = useCallback(() => {
    // TODO(nar): Implement confidence information parsing
    return {
      seriesConfidence: null,
      seriesSampleCount: undefined,
      seriesIsSampled: null,
    };
  }, []);

  return (
    <TraceMetricsWidgetQueriesSingleRequestImpl
      {...props}
      getConfidenceInformation={getConfidenceInformation}
    />
  );
}

function TraceMetricsWidgetQueriesSingleRequestImpl({
  children,
  api,
  queue,
  selection,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  onDataFetchStart,
  getConfidenceInformation,
}: TraceMetricsWidgetQueriesImplProps) {
  const config = TraceMetricsConfig;
  const organization = useOrganization();
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [sampleCount, setSampleCount] = useState<number | undefined>(undefined);
  const [isSampled, setIsSampled] = useState<boolean | null>(null);

  const afterFetchSeriesData = (result: SeriesResult) => {
    const {seriesConfidence, seriesSampleCount, seriesIsSampled} =
      getConfidenceInformation(result);

    setConfidence(seriesConfidence);
    setSampleCount(seriesSampleCount);
    setIsSampled(seriesIsSampled);
    onDataFetched?.({
      confidence: seriesConfidence,
      sampleCount: seriesSampleCount,
      isSampled: seriesIsSampled,
    });
  };

  // TODO: Handle the "default" empty state better.
  // This is required because metrics loads async and we need to wait for it to load and
  // select a default metric before firing the query.
  const disabled = widget.queries.some(q =>
    q.aggregates.includes(EMPTY_METRIC_SELECTION)
  );

  return getDynamicText({
    value: (
      <GenericWidgetQueries<SeriesResult, TableResult>
        config={config}
        api={api}
        queue={queue}
        organization={organization}
        selection={selection}
        widget={widget}
        cursor={cursor}
        limit={limit}
        dashboardFilters={dashboardFilters}
        onDataFetched={onDataFetched}
        onDataFetchStart={onDataFetchStart}
        afterFetchSeriesData={afterFetchSeriesData}
        samplingMode={SAMPLING_MODE.NORMAL}
        disabled={disabled}
        loading={disabled}
      >
        {props =>
          children({
            ...props,
            confidence,
            sampleCount,
            isSampled,
          })
        }
      </GenericWidgetQueries>
    ),
    fixed: <div />,
  });
}

export default TraceMetricsWidgetQueries;
