import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
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
  replayId: string
): ApiQueryKey {
  return [
    `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/summarize/breadcrumbs/`,
  ];
}

export function useFetchReplaySummary(options?: UseApiQueryOptions<SummaryResponse>) {
  const organization = useOrganization();
  const replay = useReplayReader();
  const replayRecord = replay?.getReplay();
  const project = useProjectFromId({project_id: replayRecord?.project_id});
  return useApiQuery<SummaryResponse>(
    createAISummaryQueryKey(organization.slug, project?.slug, replayRecord?.id ?? ''),
    {
      staleTime: 0,
      ...options,
    }
  );
}
