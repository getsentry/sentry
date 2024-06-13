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
    onSuccess(_data, {projectSlug, replayId}) {
      const url = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;
      queryClient.refetchQueries({queryKey: [url]});
    },
    retry: false,
  });
}
