import {useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {LineSeriesOption} from 'echarts';
import {Location} from 'history';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {EventsStats, Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
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

  const disableProcessedBaselineToggle =
    metricsCardinality.outcome?.forceTransactionsOnly ||
    displayMode !== 'default' ||
    !usesTransactionsDataset(eventView, yAxis);

  const apiPayload = eventView.getEventsAPIPayload(location);
  apiPayload.query = '';

  const globalSelection = eventView.getPageFilters();
  const start = globalSelection.datetime.start
    ? getUtcToLocalDateObject(globalSelection.datetime.start)
    : null;

  const end = globalSelection.datetime.end
    ? getUtcToLocalDateObject(globalSelection.datetime.end)
    : null;

  const [showBaseline, setShowBaseline] = useState<boolean>(true);
  const [metricsCompatible, setMetricsCompatible] = useState<boolean>(false);
  const [processedLineSeries, setProcessedLineSeries] = useState<
    LineSeriesOption[] | undefined
  >(undefined);

  useEffect(() => {
    let shouldCancelRequest = false;

    if (disableProcessedBaselineToggle || !showBaseline) {
      setProcessedLineSeries(undefined);
      return undefined;
    }

    doEventsRequest(api, {
      organization,
      partial: true,
      start,
      end,
      yAxis,
      environment: globalSelection.environments,
      period: globalSelection.datetime.period,
      interval: eventView.interval,
      project: globalSelection.projects,
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
              // itemStyle: {color: theme.gray200},
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
    globalSelection.environments,
    globalSelection.datetime.period,
    globalSelection.projects,
    eventView.interval,
    showBaseline,
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
      showBaseline={showBaseline}
      setShowBaseline={setShowBaseline}
      {...props}
    />
  );
}
