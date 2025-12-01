import {defined} from 'sentry/utils';
import {useQueryParamsCrossEvents} from 'sentry/views/explore/queryParams/context';

export function useCrossEventQueries() {
  const crossEvents = useQueryParamsCrossEvents();

  if (!defined(crossEvents) || crossEvents.length === 0) {
    return undefined;
  }

  const logQuery: string[] = [];
  const metricQuery: string[] = [];
  const spanQuery: string[] = [];

  for (const crossEvent of crossEvents) {
    switch (crossEvent.type) {
      case 'spans':
        spanQuery.push(crossEvent.query);
        continue;
      case 'logs':
        logQuery.push(crossEvent.query);
        continue;
      case 'metrics':
        metricQuery.push(crossEvent.query);
        continue;
      default:
        continue;
    }
  }

  return {spanQuery, logQuery, metricQuery};
}
