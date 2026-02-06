import {useMemo} from 'react';
import type {Location} from 'history';

import getApiUrl from 'sentry/utils/api/getApiUrl';
import {getTimeStampFromTableDateField, getUtcDateString} from 'sentry/utils/dates';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayTrace} from 'sentry/views/replays/detail/trace/useReplayTraces';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

import {useTraceMeta, type TraceMetaQueryResults} from './useTraceMeta';

// Fetches the meta data for all the traces in a replay and combines the results.
export function useReplayTraceMeta(
  replayRecord: HydratedReplayRecord | undefined
): TraceMetaQueryResults {
  const organization = useOrganization();

  // The replay timestamps have seconds precision, while the trace timestamps have milliseconds precision.
  // We fetch the traces with a 1 second buffer on either side of the replay timestamps to ensure we capture all
  // associated traces.
  const start = replayRecord
    ? getUtcDateString(replayRecord?.started_at.getTime() - 1000)
    : undefined;
  const end = replayRecord
    ? getUtcDateString(replayRecord?.finished_at.getTime() + 1000)
    : undefined;

  // EventView that is used to fetch the list of events for the replay
  const eventView = useMemo(() => {
    if (!replayRecord || !start || !end) {
      return null;
    }
    const replayId = replayRecord?.id;
    const projectId = replayRecord?.project_id;

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Traces in replay ${replayId}`,
      fields: ['trace', 'count(trace)', 'min(timestamp)'],
      orderby: 'min_timestamp',
      query: `replayId:${replayId}`,
      projects: [Number(projectId)],
      version: 2,
      start,
      end,
    });
  }, [replayRecord, start, end]);

  const {data: eventsData, isPending: eventsIsLoading} = useApiQuery<{
    data: TableDataRow[];
  }>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/events/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: eventView
          ? {
              ...eventView.getEventsAPIPayload({
                start,
                end,
                limit: 10,
              } as unknown as Location),
              sort: ['min_timestamp', 'trace'],
            }
          : {},
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!eventView && !!replayRecord,
    }
  );

  const replayTraces = useMemo(() => {
    const traces: ReplayTrace[] = [];

    for (const row of eventsData?.data ?? []) {
      if (row.trace) {
        traces.push({
          traceSlug: String(row.trace),
          timestamp: getTimeStampFromTableDateField(row['min(timestamp)']),
        });
      }
    }

    return traces;
  }, [eventsData]);

  const meta = useTraceMeta(replayTraces);

  const metaResults = useMemo(() => {
    return {
      data: meta.data,
      isLoading: eventsIsLoading || meta.status === 'pending',
      errors: meta.errors,
      status: meta.status,
    };
  }, [meta, eventsIsLoading]);

  return metaResults;
}
