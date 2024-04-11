import type {User} from 'sentry/types';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface Props {
  orgSlug: string;
  projectSlug: undefined | string;
  replayId: undefined | string;
}

type TResponseData = {
  data: {
    viewed_by: User[];
  };
};

function getQueryKey({orgSlug, projectSlug, replayId}: Props): ApiQueryKey {
  return [`/projects/${orgSlug}/${projectSlug}/replays/${replayId}/viewed-by/`];
}

export default function useReplayViewedByData(
  props: Props,
  options: Partial<UseApiQueryOptions<TResponseData>> = {}
) {
  return useApiQuery<TResponseData>(getQueryKey(props), {
    staleTime: Infinity,
    retry: false,
    ...options,
  });
}
