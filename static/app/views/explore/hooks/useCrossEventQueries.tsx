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
        break;
      case 'logs':
        logQuery.push(crossEvent.query);
        break;
      case 'metrics':
        metricQuery.push(crossEvent.query);
        break;
      default:
        break;
    }
  }

  return {spanQuery, logQuery, metricQuery};
}
