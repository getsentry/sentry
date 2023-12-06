import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

interface Options {
  enabled?: boolean;
  projectId?: string[];
  query?: string;
  statsPeriod?: string;
}

export const useProjectSpanMetricCounts = ({
  projectId,
  enabled,
  query,
  statsPeriod,
}: Options) => {
  const eventView = EventView.fromSavedQuery({
    name: 'Has Any Span Metrics',
    query,
    fields: ['project.id', 'count()'],
    projects: projectId && projectId.map(id => parseInt(id, 10)),
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
  });

  eventView.statsPeriod = statsPeriod;

  const result = useSpansQuery<{'count()': number; 'project.id': number}[]>({
    eventView,
    initialData: [],
    enabled,
    referrer: 'span-metrics',
  });

  return result;
};
