import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type TData = unknown;
type TError = unknown;
type TVariables = {projectSlug: string; replayId: string};
type TContext = unknown;

import useOrganization from 'sentry/utils/useOrganization';

export default function useMarkReplayViewed() {
  const organization = useOrganization();
  const api = useApi({
    persistInFlight: false,
  });

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn: ({projectSlug, replayId}) => {
      const url = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;
      return fetchMutation(api)(['POST', url]);
    },
    cacheTime: 0,
    retry: false,
  });
}
