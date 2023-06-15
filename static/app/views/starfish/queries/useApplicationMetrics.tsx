import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export type ApplicationMetrics = {
  count: number;
  'sum(span.duration)': number;
};

export const useApplicationMetrics = (_referrer = 'application-metrics') => {
  const eventView = getEventView();

  // TODO: Add referrer
  const {isLoading, data} = useSpansQuery<ApplicationMetrics[]>({
    eventView,
    initialData: [],
  });

  return {isLoading, data: data[0] ?? {}};
};

function getEventView() {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['sum(span.duration)'],
    dataset: DiscoverDatasets.SPANS_METRICS,
    projects: [1],
    version: 2,
  });
}
