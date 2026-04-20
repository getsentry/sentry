import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

type RawQueryData = {
  data: ReplayRecord[];
};

export function useUserViewedReplays() {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery(
    apiOptions.as<RawQueryData>()('/organizations/$organizationIdOrSlug/replays/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {query: 'viewed_by_me:true'},
      staleTime: 0,
    })
  );
  return {data, isError, isPending};
}
