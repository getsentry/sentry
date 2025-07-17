import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';

export interface SummaryResponse {
  data: {
    summary: string;
    time_ranges: Array<{
      error: boolean;
      feedback: boolean;
      period_end: number;
      period_start: number;
      period_title: string;
    }>;
    title: string;
  };
}

function createAISummaryQueryKey(
  orgSlug: string,
  projectSlug: string | undefined,
  replayId: string,
  query: Record<string, any> = {}
): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/breadcrumbs/`,
    {query},
  ];
}

function useAISummaryQueryKey(query: Record<string, any> = {}): ApiQueryKey {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  return createAISummaryQueryKey(
    organization.slug,
    project?.slug,
    replayRecord?.id ?? '',
    query
  );
}

export function useFetchReplaySummary(options?: UseApiQueryOptions<SummaryResponse>) {
  const queryKey = useAISummaryQueryKey();
  return useApiQuery<SummaryResponse>(queryKey, {
    staleTime: 0,
    ...options,
  });
}

/**
 * Use to force a regenerate of the AI summary, skipping the backend cache.
 */
export function useFetchReplaySummaryForceRegenerate(
  options?: UseApiQueryOptions<SummaryResponse>
) {
  const queryKey = useAISummaryQueryKey({regenerate: 'true'});
  return useApiQuery<SummaryResponse>(queryKey, {
    staleTime: 0,
    ...options,
  });
}
