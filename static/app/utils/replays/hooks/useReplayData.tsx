import {useCallback, useMemo} from 'react';

import useFetchParallelPages from 'sentry/utils/api/useFetchParallelPages';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {ApiQueryKey, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
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

export default function useReplayData({
  replayId,
  orgSlug,
  errorsPerPage = 20,
  segmentsPerPage = 100,
}: Options): Result {
  const queryClient = useQueryClient();

  const {data: replayData, isFetching: isFetchingReplay} = useApiQuery<{data: unknown}>(
    [`/organizations/${orgSlug}/replays/${replayId}/`],
    {staleTime: Infinity}
  );

  const replayRecord = useMemo(
    () => (replayData?.data ? mapResponseToReplayRecord(replayData.data) : undefined),
    [replayData?.data]
  );

  const projectSlug = useProjectSlug({replayRecord});

  const getAttachmentsQueryKey = useCallback(
    ({cursor, per_page}): ApiQueryKey => {
      return [
        `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`,
        {
          query: {
            download: true,
            per_page,
            cursor,
          },
        },
      ];
    },
    [orgSlug, projectSlug, replayId]
  );

  const {pages: attachmentPages, isFetching: isFetchingAttachments} =
    useFetchParallelPages({
      enabled: Boolean(projectSlug) && Boolean(replayRecord),
      hits: replayRecord?.count_segments ?? 0,
      getQueryKey: getAttachmentsQueryKey,
      perPage: segmentsPerPage,
    });

  const getErrorsQueryKey = useCallback(
    ({cursor, per_page}): ApiQueryKey => {
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
  );

  const {
    pages: errorPages,
    isFetching: isFetchingErrors,
    getLastResponseHeader: lastErrorsResponseHeader,
  } = useFetchParallelPages<{data: ReplayError[]}>({
    enabled: Boolean(projectSlug) && Boolean(replayRecord),
    hits: replayRecord?.count_errors ?? 0,
    getQueryKey: getErrorsQueryKey,
    perPage: errorsPerPage,
  });

  const linkHeader = lastErrorsResponseHeader?.('Link') ?? null;
  const links = parseLinkHeader(linkHeader);
  const {pages: extraErrorPages} = useFetchSequentialPages<{data: ReplayError[]}>({
    enabled: !isFetchingErrors && Boolean(links.next?.results),
    initialCursor: links.next?.cursor,
    getQueryKey: getErrorsQueryKey,
    perPage: errorsPerPage,
  });

  const clearQueryCache = useCallback(() => {
    () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/replays/${replayId}/`],
      });
      queryClient.invalidateQueries({
        queryKey: [
          `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`,
        ],
      });
      // The next one isn't optimized
      // This statement will invalidate the cache of fetched error events for replayIds
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${orgSlug}/replays-events-meta/`],
      });
    };
  }, [orgSlug, replayId, projectSlug, queryClient]);

  return useMemo(
    () => ({
      attachments: attachmentPages.flat(2),
      errors: errorPages.concat(extraErrorPages).flatMap(page => page.data),
      fetchError: undefined,
      fetching: isFetchingReplay || isFetchingAttachments || isFetchingErrors,
      onRetry: clearQueryCache,
      projectSlug,
      replayRecord,
    }),
    [
      attachmentPages,
      clearQueryCache,
      errorPages,
      extraErrorPages,
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
