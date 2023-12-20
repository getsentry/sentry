import {useCallback, useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useFetchReplayPaginatedData from 'sentry/utils/replays/hooks/useFetchReplayPaginatedData';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import RequestError from 'sentry/utils/requestError/requestError';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Options = {
  /**
   * The organization slug
   */
  orgSlug: string;

  /**
   * The replayId
   */
  replayId: string;

  /**
   * Default: 50
   * You can override this for testing
   */
  errorsPerPage?: number;

  /**
   * Default: 100
   * You can override this for testing
   */
  segmentsPerPage?: number;
};

type ReplayRecordProp = {replayRecord: undefined | ReplayRecord};

interface Result {
  attachments: unknown[];
  errors: ReplayError[];
  fetchError: undefined | RequestError;
  fetching: boolean;
  onRetry: () => void;
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
}

export default function useFetchReplayData({
  replayId,
  orgSlug,
  errorsPerPage = 50,
  segmentsPerPage = 100,
}: Options): Result {
  const {data: replayData, isFetching: isFetchingReplay} = useApiQuery<{data: unknown}>(
    [`/organizations/${orgSlug}/replays/${replayId}/`],
    {staleTime: Infinity}
  );

  const replayRecord = useMemo(
    () => (replayData?.data ? mapResponseToReplayRecord(replayData.data) : undefined),
    [replayData?.data]
  );

  const projectSlug = useProjectSlug({replayRecord});

  const {data: attachmentPages, isFetching: isFetchingAttachments} =
    useFetchReplayPaginatedData({
      enabled: Boolean(projectSlug) && Boolean(replayRecord),
      hits: replayRecord?.count_segments ?? 0,
      makeQueryKey: useCallback(
        ({cursor, per_page}) => {
          return [
            `/projects/${orgSlug}/${projectSlug}/replays/${replayRecord?.id}/recording-segments/`,
            {
              query: {
                download: true,
                per_page,
                cursor,
              },
            },
          ];
        },
        [orgSlug, projectSlug, replayRecord]
      ),
      perPage: segmentsPerPage,
    });

  const {data: errorPages, isFetching: isFetchingErrors} = useFetchReplayPaginatedData<{
    data: ReplayError[];
  }>({
    enabled: Boolean(projectSlug) && Boolean(replayRecord),
    hits: replayRecord?.count_errors ?? 0,
    makeQueryKey: useCallback(
      ({cursor, per_page}) => {
        const finishedAtClone = new Date(replayRecord?.finished_at ?? '');
        finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

        return [
          `/organizations/${orgSlug}/replays-events-meta/`,
          {
            query: {
              start: replayRecord?.started_at.toISOString(),
              end: finishedAtClone.toISOString(),
              query: `replayId:[${replayRecord?.id}]`,
              per_page,
              cursor,
            },
          },
        ];
      },
      [orgSlug, replayRecord]
    ),
    perPage: errorsPerPage,
  });

  return useMemo(
    () => ({
      attachments: attachmentPages.flat(1),
      errors: errorPages.flatMap(page => page.data),
      fetchError: undefined,
      fetching: isFetchingReplay || isFetchingAttachments || isFetchingErrors,
      onRetry: () => {},
      projectSlug,
      replayRecord,
    }),
    [
      attachmentPages,
      errorPages,
      isFetchingAttachments,
      isFetchingErrors,
      isFetchingReplay,
      projectSlug,
      replayRecord,
    ]
  );
}

function useProjectSlug({replayRecord}: ReplayRecordProp) {
  const projects = useProjects();

  return useMemo(() => {
    if (!replayRecord) {
      return null;
    }
    return projects.projects.find(p => p.id === replayRecord.project_id)?.slug ?? null;
  }, [replayRecord, projects.projects]);
}
