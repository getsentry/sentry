import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface Options {
  enabled?: boolean;
  projectId?: string[];
}

export const useHasAnySpanMetrics = ({projectId, enabled}: Options) => {
  const eventView = EventView.fromSavedQuery({
    name: 'Has Any Span Metrics',
    query: '',
    fields: ['count()'],
    projects: projectId && projectId.map(id => parseInt(id, 10)),
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
  });

  eventView.statsPeriod = SAMPLE_STATS_PERIOD;

  const result = useSpansQuery({
    eventView,
    initialData: true,
    enabled,
    referrer: 'span-metrics',
  });

  return {
    ...result,
    hasMetrics: result?.data?.[0]?.count > 0,
  };
};

const SAMPLE_STATS_PERIOD = '10d'; // The time period in which to check for any presence of span metrics
