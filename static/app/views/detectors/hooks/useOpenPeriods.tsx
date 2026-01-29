import type {GroupOpenPeriod} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type CommonParams = {
  cursor?: string;
  end?: string | null;
  eventId?: string;
  limit?: number;
  start?: string | null;
  statsPeriod?: string | null;
};

type UseOpenPeriodsParams =
  | ({
      detectorId: string;
    } & CommonParams)
  | ({
      groupId: string;
    } & CommonParams);

function makeOpenPeriodsQueryKey({
  orgSlug,
  ...params
}: UseOpenPeriodsParams & {orgSlug: string}): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/open-periods/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
    {
      query: params,
    },
  ];
}

export function useOpenPeriods(
  params: UseOpenPeriodsParams,
  options: Partial<UseApiQueryOptions<GroupOpenPeriod[]>> = {}
) {
  const organization = useOrganization();

  return useApiQuery<GroupOpenPeriod[]>(
    makeOpenPeriodsQueryKey({orgSlug: organization.slug, ...params}),
    {
      staleTime: 0,
      retry: false,
      ...options,
    }
  );
}

export function useEventOpenPeriod(
  params: {
    eventId: string | undefined;
    groupId: string;
  },
  options: Partial<UseApiQueryOptions<GroupOpenPeriod[]>> = {}
) {
  const query = useOpenPeriods(
    {
      groupId: params.groupId,
      eventId: params.eventId,
      limit: 1,
    },
    {
      enabled: defined(options.enabled)
        ? options.enabled
        : defined(params.eventId) && defined(params.groupId),
      ...options,
    }
  );

  return {
    ...query,
    openPeriod: query.data?.[0] ?? null,
  };
}
