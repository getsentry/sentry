import getApiUrl from 'sentry/utils/api/getApiUrl';
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
      const url = getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug,
            replayId,
          },
        }
      );
      return fetchMutation({method: 'POST', url});
    },
    onSuccess(_data, {projectSlug, replayId}) {
      const url = getApiUrl(
        '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/viewed-by/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            projectIdOrSlug: projectSlug,
            replayId,
          },
        }
      );
      queryClient.refetchQueries({queryKey: [url]});
    },
    retry: false,
  });
}
