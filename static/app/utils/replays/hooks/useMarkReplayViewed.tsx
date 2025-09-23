import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type TData = unknown;
type TError = unknown;
type TVariables = {projectSlug: string; replayId: string};
type TContext = unknown;

export default function useMarkReplayViewed() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation<TData, TError, TVariables, TContext>({
    mutationFn: ({projectSlug, replayId}) => {
      const url = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;
      return fetchMutation({method: 'POST', url});
    },
    onSuccess(_data, {projectSlug, replayId}) {
      const viewedByUrl = `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`;
      queryClient.refetchQueries({queryKey: [viewedByUrl]});

      const replayListUrl = `/organizations/${organization.slug}/replays/`;
      queryClient.refetchQueries({queryKey: [replayListUrl]});
    },
    retry: false,
  });
}
