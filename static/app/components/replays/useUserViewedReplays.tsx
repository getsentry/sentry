import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

type RawQueryData = {
  data: ReplayRecord[];
};

export default function useUserViewedReplays() {
  const organization = useOrganization();
  const {data, isError, isPending} = useApiQuery<RawQueryData>(
    [
      `/organizations/${organization.slug}/replays/`,
      {query: {query: `viewed_by_me:true`}},
    ],
    {staleTime: 0}
  );
  return {data, isError, isPending};
}
