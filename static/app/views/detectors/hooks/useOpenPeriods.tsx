import type {GroupOpenPeriod} from 'sentry/types/group';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type CommonParams = {
  cursor?: string;
  end?: string | null;
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
    `/organizations/${orgSlug}/open-periods/`,
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
      ...options,
    }
  );
}
