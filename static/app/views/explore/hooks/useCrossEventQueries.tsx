import {useMemo} from 'react';

import {defined} from 'sentry/utils';
import {MAX_CROSS_EVENT_QUERIES} from 'sentry/views/explore/constants';
import {useQueryParamsCrossEvents} from 'sentry/views/explore/queryParams/context';
import {isCrossEventType} from 'sentry/views/explore/queryParams/crossEvent';

export function useCrossEventQueries() {
  const crossEvents = useQueryParamsCrossEvents();

  return useMemo(() => {
    if (!defined(crossEvents) || crossEvents.length === 0) {
      return undefined;
    }

    // We only want to include the first MAX_CROSS_EVENT_QUERIES cross events in the
    // actual API request to avoid overwhelming the backend.
    const slicedCrossEvents = crossEvents
      .filter(crossEvent => isCrossEventType(crossEvent.type))
      .slice(0, MAX_CROSS_EVENT_QUERIES);

    const logQuery: string[] = [];
    const metricQuery: string[] = [];
    const spanQuery: string[] = [];

    for (const crossEvent of slicedCrossEvents) {
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
  }, [crossEvents]);
}
