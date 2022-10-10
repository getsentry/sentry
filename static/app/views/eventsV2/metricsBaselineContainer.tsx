import {useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {LineSeriesOption} from 'echarts';
import {Location} from 'history';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {isMultiSeriesStats, lightenHexToRgb} from 'sentry/components/charts/utils';
import {EventsStats, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {aggregateMultiPlotType, isEquation} from 'sentry/utils/discover/fields';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import localStorage from 'sentry/utils/localStorage';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import theme from 'sentry/utils/theme';
import {transformSeries} from 'sentry/views/dashboardsV2/widgetCard/widgetQueries';

import {SeriesWithOrdering} from '../dashboardsV2/datasetConfig/errorsAndTransactions';

import {PROCESSED_BASELINE_TOGGLE_KEY} from './chartFooter';
import ResultsChart from './resultsChart';
import {usesTransactionsDataset} from './utils';

type MetricsBaselineContainerProps = {
  api: Client;
  confirmedQuery: boolean;
  eventView: EventView;
  location: Location;
  onAxisChange: (value: string[]) => void;
  onDisplayChange: (value: string) => void;
  onIntervalChange: (value: string | undefined) => void;
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
  router,
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
    !usesTransactionsDataset(eventView, yAxis) ||
    yAxis.some(isEquation);

  const apiPayload = eventView.getEventsAPIPayload(location);
  apiPayload.query = '';

  const pageFilters = eventView.getPageFilters();
  const start = pageFilters.datetime.start
    ? getUtcToLocalDateObject(pageFilters.datetime.start)
    : null;

  const end = pageFilters.datetime.end
    ? getUtcToLocalDateObject(pageFilters.datetime.end)
    : null;

  const showBaseline =
    (location.query.baseline ?? localStorage.getItem(PROCESSED_BASELINE_TOGGLE_KEY)) ===
    '0'
      ? false
      : true;
  const [metricsCompatible, setMetricsCompatible] = useState<boolean>(true);
  const [processedLineSeries, setProcessedLineSeries] = useState<
    LineSeriesOption[] | undefined
  >(undefined);
  const [processedTotal, setProcessedTotal] = useState<number | undefined>(undefined);
  const [loadingTotals, setLoadingTotals] = useState<boolean>(true);
  const [loadingSeries, setLoadingSeries] = useState<boolean>(true);

  useEffect(() => {
    let shouldCancelRequest = false;

    if (!isRollingOut || disableProcessedBaselineToggle || !showBaseline) {
      setProcessedTotal(undefined);
      setLoadingTotals(false);
      return undefined;
    }

    setLoadingTotals(true);

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
        const total = data.data[0]?.['count()'];

        if (defined(total)) {
          setProcessedTotal(parseInt(total as string, 10));
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
      setLoadingSeries(false);
      setProcessedLineSeries(undefined);
      return undefined;
    }

    setLoadingSeries(true);
    setProcessedLineSeries(undefined);

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

          const color = theme.charts.getColorPalette(seriesWithOrdering.length - 2);
          const additionalSeriesColor = lightenHexToRgb(color);

          seriesWithOrdering.forEach(([order, series]) =>
            additionalSeries.push(
              LineSeries({
                name: series.seriesName,
                data: series.data.map(({name, value}) => [name, value]),
                stack:
                  aggregateMultiPlotType(yAxis[order]) === 'area'
                    ? 'processed'
                    : undefined,
                lineStyle: {
                  color: additionalSeriesColor[order],
                  type: 'dashed',
                  width: 1.5,
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
              lineStyle: {color: theme.gray300, type: 'dashed', width: 1.5},
              animation: false,
              animationThreshold: 1,
              animationDuration: 0,
            })
          );
        }

        setLoadingSeries(false);
        setMetricsCompatible(true);
        setProcessedLineSeries(additionalSeries);
      })
      .catch(() => {
        if (shouldCancelRequest) {
          return;
        }
        setLoadingSeries(false);
        setMetricsCompatible(false);
        setProcessedLineSeries(undefined);
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
      router={router}
      processedLineSeries={showBaseline ? processedLineSeries : undefined}
      disableProcessedBaselineToggle={
        disableProcessedBaselineToggle || !metricsCompatible
      }
      processedTotal={processedTotal}
      loadingProcessedTotals={loadingTotals}
      showBaseline={showBaseline}
      loadingProcessedEventsBaseline={loadingSeries}
      reloadingProcessedEventsBaseline={processedLineSeries !== null && loadingSeries}
      setShowBaseline={(value: boolean) => {
        router.push({
          pathname: location.pathname,
          query: {
            ...location.query,
            baseline: value === false ? '0' : '1',
          },
        });
      }}
      {...props}
    />
  );
}
