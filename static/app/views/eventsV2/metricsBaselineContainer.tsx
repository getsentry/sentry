import {useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {LineSeriesOption} from 'echarts';
import {Location} from 'history';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {EventsStats, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import theme from 'sentry/utils/theme';
import {transformSeries} from 'sentry/views/dashboardsV2/widgetCard/widgetQueries';

import {SeriesWithOrdering} from '../dashboardsV2/datasetConfig/errorsAndTransactions';

import ResultsChart from './resultsChart';
import {usesTransactionsDataset} from './utils';

type MetricsBaselineContainerProps = {
  api: Client;
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  onTopEventsChange: (value: string) => void;

  organization: Organization;
  router: InjectedRouter;
  // chart footer props
  total: number | null;
  yAxis: string[];
};

export function MetricsBaselineContainer({
  eventView,
  yAxis,
  location,
  organization,
  api,
  ...props
}: MetricsBaselineContainerProps) {
  const metricsCardinality = useMetricsCardinalityContext();
  const displayMode = eventView.getDisplayMode();

  const isRollingOut =
    organization.features.includes('server-side-sampling') &&
    organization.features.includes('mep-rollout-flag') &&
    organization.features.includes('discover-metrics-baseline');

  const disableProcessedBaselineToggle =
    metricsCardinality.outcome?.forceTransactionsOnly ||
    displayMode !== 'default' ||
    !usesTransactionsDataset(eventView, yAxis);

  const apiPayload = eventView.getEventsAPIPayload(location);
  apiPayload.query = '';

  const pageFilters = eventView.getPageFilters();
  const start = pageFilters.datetime.start
    ? getUtcToLocalDateObject(pageFilters.datetime.start)
    : null;

  const end = pageFilters.datetime.end
    ? getUtcToLocalDateObject(pageFilters.datetime.end)
    : null;

  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [metricsCompatible, setMetricsCompatible] = useState<boolean>(false);
  const [processedLineSeries, setProcessedLineSeries] = useState<
    LineSeriesOption[] | undefined
  >(undefined);
  const [processedTotal, setProcessedTotal] = useState<number | undefined>(undefined);
  const [loadingTotals, setLoadingTotals] = useState<boolean>(true);

  useEffect(() => {
    let shouldCancelRequest = false;

    if (!isRollingOut || disableProcessedBaselineToggle || !showBaseline) {
      setProcessedTotal(undefined);
      setLoadingTotals(false);
      return undefined;
    }

    doDiscoverQuery<EventsTableData>(api, `/organizations/${organization.slug}/events/`, {
      ...eventView.generateQueryStringObject(),
      field: ['count()'],
      query: '',
      sort: [],
      referrer: 'api.discover.processed-baseline-total',
      ...{dataset: DiscoverDatasets.METRICS},
    })
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        const [data] = response;
        const total = data.data[0]['count()'] as string;

        if (defined(total)) {
          setProcessedTotal(parseInt(total, 10));
          setLoadingTotals(false);
        } else {
          setProcessedTotal(undefined);
          setLoadingTotals(false);
        }
      })
      .catch(() => {
        if (shouldCancelRequest) {
          return;
        }
        setMetricsCompatible(false);
        setLoadingTotals(false);
        setProcessedTotal(undefined);
      });
    return () => {
      shouldCancelRequest = true;
    };
  }, [
    disableProcessedBaselineToggle,
    api,
    organization,
    eventView,
    showBaseline,
    isRollingOut,
  ]);

  useEffect(() => {
    let shouldCancelRequest = false;

    if (!isRollingOut || disableProcessedBaselineToggle || !showBaseline) {
      setProcessedLineSeries(undefined);
      return undefined;
    }

    doEventsRequest(api, {
      organization,
      partial: true,
      start,
      end,
      yAxis,
      environment: pageFilters.environments,
      period: pageFilters.datetime.period,
      interval: eventView.interval,
      project: pageFilters.projects,
      query: '',
      queryExtras: {dataset: DiscoverDatasets.METRICS},
    })
      .then(response => {
        if (shouldCancelRequest) {
          return;
        }

        const additionalSeries: LineSeriesOption[] = [];

        if (isMultiSeriesStats(response)) {
          let seriesWithOrdering: SeriesWithOrdering[] = [];

          seriesWithOrdering = Object.keys(response).map((seriesName: string) => {
            const prefixedName = `processed events: ${seriesName}`;
            const seriesData: EventsStats = response[seriesName];
            return [
              seriesData.order || 0,
              transformSeries(seriesData, prefixedName, seriesName),
            ];
          });

          const additionalSeriesColor = theme.charts.getColorPalette(
            seriesWithOrdering.length - 2
          );

          seriesWithOrdering.forEach(([order, series]) =>
            additionalSeries.push(
              LineSeries({
                name: series.seriesName,
                data: series.data.map(({name, value}) => [name, value]),
                lineStyle: {
                  color: additionalSeriesColor[order],
                  type: 'dashed',
                  width: 1,
                  opacity: 0.5,
                },
                itemStyle: {color: additionalSeriesColor[order]},
                animation: false,
                animationThreshold: 1,
                animationDuration: 0,
              })
            )
          );
        } else {
          const field = yAxis[0];
          const prefixedName = `processed events: ${field}`;
          const transformed = transformSeries(response, prefixedName, field);
          additionalSeries.push(
            LineSeries({
              name: transformed.seriesName,
              data: transformed.data.map(({name, value}) => [name, value]),
              lineStyle: {type: 'dashed', width: 1, opacity: 0.5},
              animation: false,
              animationThreshold: 1,
              animationDuration: 0,
            })
          );
        }

        setMetricsCompatible(true);
        setProcessedLineSeries(additionalSeries);
      })
      .catch(() => {
        if (shouldCancelRequest) {
          return;
        }
        setMetricsCompatible(false);
      });
    return () => {
      shouldCancelRequest = true;
    };
  }, [
    disableProcessedBaselineToggle,
    api,
    organization,
    start,
    end,
    yAxis,
    pageFilters.environments,
    pageFilters.datetime.period,
    pageFilters.projects,
    eventView.interval,
    showBaseline,
    isRollingOut,
  ]);

  return (
    <ResultsChart
      organization={organization}
      eventView={eventView}
      location={location}
      yAxis={yAxis}
      processedLineSeries={showBaseline ? processedLineSeries : undefined}
      disableProcessedBaselineToggle={
        disableProcessedBaselineToggle || !metricsCompatible
      }
      processedTotal={processedTotal}
      showBaseline={showBaseline}
      setShowBaseline={setShowBaseline}
      loadingProcessedTotals={loadingTotals}
      {...props}
    />
  );
}
