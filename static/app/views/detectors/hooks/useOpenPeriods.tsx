import {queryOptions, useQuery} from '@tanstack/react-query';

import type {GroupOpenPeriod} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {QueryParamValue} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

type CommonParams = {
  cursor?: QueryParamValue;
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

export function openPeriodsApiOptions({
  organization,
  limit,
  ...params
}: UseOpenPeriodsParams & {organization: Organization}) {
  return queryOptions({
    ...apiOptions.as<GroupOpenPeriod[]>()(
      '/organizations/$organizationIdOrSlug/open-periods/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          ...params,
          per_page: limit,
        },
        staleTime: 0,
      }
    ),
    retry: false,
  });
}

export function useOpenPeriods(
  params: UseOpenPeriodsParams,
  options: {enabled?: boolean} = {}
) {
  const organization = useOrganization();

  return useQuery({
    ...openPeriodsApiOptions({organization, ...params}),
    ...options,
  });
}

export function useEventOpenPeriod(params: {
  eventId: string | undefined;
  groupId: string;
}) {
  const organization = useOrganization();

  return useQuery({
    ...openPeriodsApiOptions({organization, limit: 1, ...params}),
    enabled: defined(params.eventId) && defined(params.groupId),
    select: ({json}) => json[0] ?? null,
  });
}
