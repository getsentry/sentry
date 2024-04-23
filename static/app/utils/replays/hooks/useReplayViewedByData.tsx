import type {User} from 'sentry/types/user';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectSlug: undefined | string;
  replayId: undefined | string;
}

type TResponseData = {
  data: {
    viewed_by: User[];
  };
};

export default function useReplayViewedByData(
  {projectSlug, replayId}: Props,
  options: Partial<UseApiQueryOptions<TResponseData>> = {}
) {
  const organization = useOrganization();
  return useApiQuery<TResponseData>(
    [`/projects/${organization.slug}/${projectSlug}/replays/${replayId}/viewed-by/`],
    {
      enabled: Boolean(projectSlug && replayId),
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}
