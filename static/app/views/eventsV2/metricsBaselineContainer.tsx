import {useEffect, useState} from 'react';
import {InjectedRouter} from 'react-router';
import {Location} from 'history';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import {EventsStats, MultiSeriesEventsStats, Organization} from 'sentry/types';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useMetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';

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

  const [metricsResponse, setMetricsResponse] = useState<
    EventsStats | MultiSeriesEventsStats | null
  >(null);
  const [metricsCompatible, setMetricsCompatible] = useState<boolean>(false);

  const additionalSeries: EventsStats | MultiSeriesEventsStats | undefined = undefined;

  useEffect(() => {
    let shouldCancelRequest = false;

    if (disableProcessedBaselineToggle) {
      setMetricsResponse(null);
      setMetricsCompatible(false);
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
        setMetricsResponse(response);
        setMetricsCompatible(true);
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
  ]);

  return (
    <ResultsChart
      organization={organization}
      eventView={eventView}
      location={location}
      yAxis={yAxis}
      disableProcessedBaselineToggle={
        disableProcessedBaselineToggle || !metricsCompatible
      }
      {...props}
    />
  );
}
