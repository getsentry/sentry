import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {HydratedReplayRecord} from 'sentry/views/replays/types';

interface TraceConnectedError {
  id: string;
  issue: string;
  level: string;
  message: string;
  project: string;
  project_id: number;
  timestamp: number;
  title: string;
}

interface TraceConnectedErrorsResponse {
  data: TraceConnectedError[];
  meta: {
    fields: Record<string, string>;
  };
}

interface Props {
  replayRecord: HydratedReplayRecord | undefined;
  traceIds: string[];
  enabled?: boolean;
}

export default function useTraceConnectedErrors({
  replayRecord,
  traceIds,
  enabled = true,
}: Props) {
  const organization = useOrganization();

  return useApiQuery<TraceConnectedErrorsResponse>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          dataset: 'discover',
          field: [
            'id',
            'title',
            'message',
            'timestamp',
            'project',
            'project.id',
            'issue',
            'tags[level]',
          ],
          query: `trace:[${traceIds.join(',')}] !event.type:transaction`,
          start: replayRecord?.started_at?.toISOString(),
          end: replayRecord?.finished_at?.toISOString(),
          per_page: 100,
          sort: '-timestamp',
          referrer: 'replay.trace_connected_errors',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: enabled && Boolean(traceIds.length > 0 && replayRecord),
      retry: false,
    }
  );
}
