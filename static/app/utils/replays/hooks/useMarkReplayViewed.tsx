import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
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
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn: ({projectSlug, replayId}) => {
      const url = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;
      return fetchMutation(api)(['POST', url]);
    },
    onMutate({replayId}: TVariables) {
      const cache = queryClient.getQueryCache();
      cache
        .findAll([`/organizations/${organization.slug}/replays/${replayId}/viewed-by/`])
        .forEach(response => response.invalidate());
    },
    retry: false,
  });
}
