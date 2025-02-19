import {useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';

import type {TraceViewQueryParams} from './useTraceQueryParams';

export function useTraceEventView(
  traceSlug: string,
  params: TraceViewQueryParams,
  partialSavedQuery?: Partial<NewQuery>
): EventView {
  return useMemo(() => {
    let startTimeStamp = params.start;
    let endTimeStamp = params.end;

    // If timestamp exists in the query params, we want to use it to set the start and end time
    // with a buffer of 1.5 days, for retrieving events belonging to the trace.
    if (typeof params.timestamp === 'number') {
      const buffer = 36 * 60 * 60 * 1000; // 1.5 days in milliseconds
      const dateFromTimestamp = new Date(params.timestamp * 1000);

      startTimeStamp = new Date(dateFromTimestamp.getTime() - buffer).toISOString();
      endTimeStamp = new Date(dateFromTimestamp.getTime() + buffer).toISOString();
    }

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start: startTimeStamp,
      end: endTimeStamp,
      range: !(startTimeStamp || endTimeStamp) ? params.statsPeriod : undefined,
      ...partialSavedQuery,
    });
  }, [params, traceSlug, partialSavedQuery]);
}
