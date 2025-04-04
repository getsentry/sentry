import {Fragment, useCallback, useState} from 'react';

import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {
  Confidence,
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import getDynamicText from 'sentry/utils/getDynamicText';
import useOrganization from 'sentry/utils/useOrganization';
import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {
  convertEventsStatsToTimeSeriesData,
  transformToSeriesMap,
} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import {type DashboardFilters, DisplayType, type Widget} from '../types';
import {isEventsStats} from '../utils/isEventsStats';

import type {
  GenericWidgetQueriesChildrenProps,
  OnDataFetchedProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

type SeriesResult = EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
type TableResult = TableData | EventsTableData;

type SpansWidgetQueriesProps = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => React.JSX.Element;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetched?: (results: OnDataFetchedProps) => void;
};

type SpansWidgetQueriesImplProps = SpansWidgetQueriesProps & {
  getConfidenceInformation: (result: SeriesResult) => {
    seriesConfidence: Confidence | null;
    seriesIsSampled: boolean | null;
    seriesSampleCount: number | undefined;
  };
};

function SpansWidgetQueries(props: SpansWidgetQueriesProps) {
  const organization = useOrganization();

  const getConfidenceInformation = useCallback(
    (result: SeriesResult) => {
      let seriesConfidence;
      let seriesSampleCount;
      let seriesIsSampled;

      if (isEventsStats(result)) {
        seriesConfidence = determineSeriesConfidence(result);
        const {sampleCount: calculatedSampleCount, isSampled: calculatedIsSampled} =
          determineSeriesSampleCountAndIsSampled(
            [
              convertEventsStatsToTimeSeriesData(
                props.widget.queries[0]?.aggregates[0] ?? '',
                result
              )[1],
            ],
            false
          );
        seriesSampleCount = calculatedSampleCount;
        seriesIsSampled = calculatedIsSampled;
      } else {
        const dedupedYAxes = dedupeArray(props.widget.queries[0]?.aggregates ?? []);
        const seriesMap = transformToSeriesMap(result, dedupedYAxes);
        const series = dedupedYAxes.flatMap(yAxis => seriesMap[yAxis]).filter(defined);
        const {sampleCount: calculatedSampleCount, isSampled: calculatedIsSampled} =
          determineSeriesSampleCountAndIsSampled(
            series,
            Object.keys(result).filter(seriesName => seriesName.toLowerCase() !== 'other')
              .length > 0
          );
        seriesSampleCount = calculatedSampleCount;
        seriesConfidence = combineConfidenceForSeries(series);
        seriesIsSampled = calculatedIsSampled;
      }
      return {
        seriesConfidence,
        seriesSampleCount,
        seriesIsSampled,
      };
    },
    [props.widget.queries]
  );

  // TODO: Remove the check for the display type when we support progressive loading
  // for the table request as well.
  if (
    organization.features.includes('visibility-explore-progressive-loading') &&
    ![DisplayType.TABLE, DisplayType.BIG_NUMBER].includes(props.widget.displayType)
  ) {
    return (
      <SpansWidgetQueriesProgressiveLoadingImpl
        {...props}
        getConfidenceInformation={getConfidenceInformation}
      />
    );
  }

  return (
    <SpansWidgetQueriesSingleRequestImpl
      {...props}
      getConfidenceInformation={getConfidenceInformation}
    />
  );
}

function SpansWidgetQueriesProgressiveLoadingImpl({
  children,
  api,
  selection,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  getConfidenceInformation,
}: SpansWidgetQueriesImplProps) {
  const config = SpansConfig;
  const organization = useOrganization();

  // The best effort response props are stored to render after the preflight
  const [bestEffortChildrenProps, setBestEffortChildrenProps] =
    useState<GenericWidgetQueriesChildrenProps | null>(null);

  const afterFetchSeriesData = (result: SeriesResult) => {
    const {seriesConfidence, seriesSampleCount, seriesIsSampled} =
      getConfidenceInformation(result);

    onDataFetched?.({
      confidence: seriesConfidence,
      sampleCount: seriesSampleCount,
      isSampled: seriesIsSampled,
    });
  };

  return getDynamicText({
    value: (
      <GenericWidgetQueries<SeriesResult, TableResult>
        config={config}
        api={api}
        organization={organization}
        selection={selection}
        widget={widget}
        cursor={cursor}
        limit={limit}
        dashboardFilters={dashboardFilters}
        afterFetchSeriesData={afterFetchSeriesData}
        samplingMode={SAMPLING_MODE.PREFLIGHT}
        onDataFetched={() => {
          setBestEffortChildrenProps(null);
        }}
      >
        {preflightProps => (
          <Fragment>
            {preflightProps.loading || defined(bestEffortChildrenProps) ? (
              // This state is returned when the preflight query is running, or when
              // the best effort query has completed.
              children({
                ...(bestEffortChildrenProps ?? preflightProps),
                isProgressivelyLoading: preflightProps.loading,
              })
            ) : (
              <GenericWidgetQueries<SeriesResult, TableResult>
                config={config}
                api={api}
                organization={organization}
                selection={selection}
                widget={widget}
                cursor={cursor}
                limit={limit}
                dashboardFilters={dashboardFilters}
                afterFetchSeriesData={afterFetchSeriesData}
                samplingMode={SAMPLING_MODE.BEST_EFFORT}
                onDataFetched={results => {
                  setBestEffortChildrenProps({
                    ...results,
                    loading: false,
                    isProgressivelyLoading: false,
                  });
                  onDataFetched?.(results);
                }}
              >
                {bestEffortProps => {
                  if (bestEffortProps.loading) {
                    return children({
                      ...preflightProps,
                      loading: true,
                      isProgressivelyLoading:
                        !preflightProps.errorMessage && !bestEffortProps.errorMessage,
                    });
                  }
                  return children(bestEffortProps);
                }}
              </GenericWidgetQueries>
            )}
          </Fragment>
        )}
      </GenericWidgetQueries>
    ),
    fixed: <div />,
  });
}

function SpansWidgetQueriesSingleRequestImpl({
  children,
  api,
  selection,
  widget,
  cursor,
  limit,
  dashboardFilters,
  onDataFetched,
  getConfidenceInformation,
}: SpansWidgetQueriesImplProps) {
  const config = SpansConfig;

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

  return getDynamicText({
    value: (
      <GenericWidgetQueries<SeriesResult, TableResult>
        config={config}
        api={api}
        organization={organization}
        selection={selection}
        widget={widget}
        cursor={cursor}
        limit={limit}
        dashboardFilters={dashboardFilters}
        onDataFetched={onDataFetched}
        afterFetchSeriesData={afterFetchSeriesData}
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

export default SpansWidgetQueries;
