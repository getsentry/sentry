import type {
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import {filterSessionsInTimeWindow, getSessionsInterval} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';

const SESSIONS_QUERY_STALE_TIME_MS = 30 * 1000; // cache for 30 seconds

type Props = {
  field: SessionFieldWithOperation[];
  end?: string;
  environment?: string[];
  groupBy?: string[];
  interval?: string;
  isDisabled?: boolean;
  project?: number[];
  query?: string;
  shouldFilterSessionsInTimeWindow?: boolean;
  start?: string;
  statsPeriod?: string | null;
};

export function useSessionsRequest({
  shouldFilterSessionsInTimeWindow,
  project,
  environment,
  field,
  statsPeriod,
  start,
  end,
  query,
  groupBy,
  interval,
}: Omit<Props, 'api' | 'children' | 'organization'>) {
  const organization = useOrganization();
  const baseQueryParams = {
    project,
    environment,
    field,
    statsPeriod,
    query,
    groupBy,
    start,
    end,
    interval: interval
      ? interval
      : getSessionsInterval(
          {start, end, period: statsPeriod},
          {highFidelity: organization.features.includes('minute-resolution-sessions')}
        ),
  };

  const sessionQuery = useApiQuery<SessionApiResponse>(
    [`/organizations/${organization.slug}/sessions/`, {query: baseQueryParams}],
    {
      staleTime: SESSIONS_QUERY_STALE_TIME_MS,
    }
  );

  return {
    ...sessionQuery,
    data:
      sessionQuery.isPending || !sessionQuery.data
        ? null
        : shouldFilterSessionsInTimeWindow
          ? filterSessionsInTimeWindow(
              sessionQuery.data,
              baseQueryParams.start,
              baseQueryParams.end
            )
          : sessionQuery.data,
  };
}
