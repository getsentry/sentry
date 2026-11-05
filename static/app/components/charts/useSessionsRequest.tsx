import {useQuery} from '@tanstack/react-query';

import type {
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {filterSessionsInTimeWindow, getSessionsInterval} from 'sentry/utils/sessions';
import {useOrganization} from 'sentry/utils/useOrganization';

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
      : getSessionsInterval({start, end, period: statsPeriod}),
  };

  const sessionQuery = useQuery({
    ...apiOptions.as<SessionApiResponse>()(
      '/organizations/$organizationIdOrSlug/sessions/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
        },
        query: baseQueryParams,
        staleTime: 0,
      }
    ),
  });

  return {
    isPending: sessionQuery.isPending,
    isLoading: sessionQuery.isLoading,
    isFetching: sessionQuery.isFetching,
    isError: sessionQuery.isError,
    error: sessionQuery.error,
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
