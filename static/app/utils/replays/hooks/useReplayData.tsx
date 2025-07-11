import {useCallback, useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import useFetchParallelPages from 'sentry/utils/api/useFetchParallelPages';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Options = {
  /**
   * The organization slug
   */
  orgSlug: string;

  /**
   * The replayId
   */
  replayId: string | undefined;

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

interface Result {
  attachmentError: undefined | RequestError[];
  attachments: unknown[];
  errors: ReplayError[];
  fetchError: undefined | RequestError;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
  status: 'pending' | 'error' | 'success';
}

/**
 * A react hook to load core replay data over the network.
 *
 * Core replay data includes:
 * 1. The root replay EventTransaction object
 *    - This includes `startTimestamp`, and `tags`
 * 2. RRWeb, Breadcrumb, and Span attachment data
 *    - We make an API call to get a list of segments, each segment contains a
 *      list of attachments
 *    - There may be a few large segments, or many small segments. It depends!
 *      ie: If the replay has many events/errors then there will be many small segments,
 *      or if the page changes rapidly across each pageload, then there will be
 *      larger segments, but potentially fewer of them.
 * 3. Related Event data
 *    - Event details are not part of the attachments payload, so we have to
 *      request them separately
 *
 * This function should stay focused on loading data over the network.
 * Front-end processing, filtering and re-mixing of the different data streams
 * must be delegated to the `ReplayReader` class.
 *
 * @param {orgSlug, replayId} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({
  replayId,
  orgSlug,
  errorsPerPage = 50,
  segmentsPerPage = 100,
}: Options): Result {
  const queryClient = useQueryClient();

  const enableReplayRecord = Boolean(replayId);

  // Fetch every field of the replay. The TS type definition lists every field
  // that's available. It's easier to ask for them all and not have to deal with
  // partial types or nullable fields.
  // We're overfetching for sure.
  const {
    data: replayData,
    status: fetchReplayStatus,
    error: fetchReplayError,
  } = useApiQuery<{data: unknown}>([`/organizations/${orgSlug}/replays/${replayId}/`], {
    enabled: enableReplayRecord,
    retry: false,
    staleTime: Infinity,
  });
  const replayRecord = useMemo(
    () => (replayData?.data ? mapResponseToReplayRecord(replayData.data) : undefined),
    [replayData?.data]
  );

  const projectSlug = useReplayProjectSlug({replayRecord});

  const getAttachmentsQueryKey = useCallback(
    ({cursor, per_page}: any): ApiQueryKey => {
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

  const enableAttachments =
    !fetchReplayError &&
    Boolean(replayId) &&
    Boolean(projectSlug) &&
    Boolean(replayRecord);

  const {
    pages: attachmentPages,
    status: fetchAttachmentsStatus,
    error: fetchAttachmentsError,
  } = useFetchParallelPages({
    enabled: enableAttachments,
    getQueryKey: getAttachmentsQueryKey,
    hits: replayRecord?.count_segments ?? 0,
    perPage: segmentsPerPage,
  });

  const getErrorsQueryKey = useCallback(
    ({cursor, per_page}: any): ApiQueryKey => {
      // Clone the `finished_at` time and bump it up one second because finishedAt
      // has the `ms` portion truncated, while replays-events-meta operates on
      // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
      // while the event is saved with `12:00:00.450Z`.
      const finishedAtClone = new Date(replayRecord?.finished_at ?? '');
      finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

      return [
        `/organizations/${orgSlug}/replays-events-meta/`,
        {
          query: {
            referrer: 'replay_details',
            dataset: DiscoverDatasets.DISCOVER,
            start: replayRecord?.started_at?.toISOString() ?? '',
            end: finishedAtClone.toISOString(),
            project: ALL_ACCESS_PROJECTS,
            query: `replayId:[${replayRecord?.id}]`,
            per_page,
            cursor,
          },
        },
      ];
    },
    [orgSlug, replayRecord]
  );

  const getPlatformErrorsQueryKey = useCallback(
    ({cursor, per_page}: any): ApiQueryKey => {
      // Clone the `finished_at` time and bump it up one second because finishedAt
      // has the `ms` portion truncated, while replays-events-meta operates on
      // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
      // while the event is saved with `12:00:00.450Z`.
      const finishedAtClone = new Date(replayRecord?.finished_at ?? '');
      finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

      return [
        `/organizations/${orgSlug}/replays-events-meta/`,
        {
          query: {
            referrer: 'replay_details',
            dataset: DiscoverDatasets.ISSUE_PLATFORM,
            start: replayRecord?.started_at?.toISOString() ?? '',
            end: finishedAtClone.toISOString(),
            project: ALL_ACCESS_PROJECTS,
            query: `replayId:[${replayRecord?.id}]`,
            per_page,
            cursor,
          },
        },
      ];
    },
    [orgSlug, replayRecord]
  );

  const enableErrors = Boolean(replayRecord) && Boolean(projectSlug);
  const {
    pages: errorPages,
    status: fetchErrorsStatus,
    getLastResponseHeader: lastErrorsResponseHeader,
  } = useFetchParallelPages<{data: ReplayError[]}>({
    enabled: enableErrors,
    hits: replayRecord?.count_errors ?? 0,
    getQueryKey: getErrorsQueryKey,
    perPage: errorsPerPage,
  });

  const linkHeader = lastErrorsResponseHeader?.('Link') ?? null;
  const links = parseLinkHeader(linkHeader);
  const enableExtraErrors =
    Boolean(replayRecord) &&
    (!replayRecord?.count_errors || Boolean(links.next?.results)) &&
    fetchErrorsStatus === 'success';
  const {pages: extraErrorPages, status: fetchExtraErrorsStatus} =
    useFetchSequentialPages<{data: ReplayError[]}>({
      enabled: enableExtraErrors,
      initialCursor: links.next?.cursor,
      getQueryKey: getErrorsQueryKey,
      perPage: errorsPerPage,
    });

  const {pages: platformErrorPages, status: fetchPlatformErrorsStatus} =
    useFetchSequentialPages<{data: ReplayError[]}>({
      enabled: true,
      getQueryKey: getPlatformErrorsQueryKey,
      perPage: errorsPerPage,
    });

  const clearQueryCache = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${orgSlug}/replays/${replayId}/`],
    });
    queryClient.invalidateQueries({
      queryKey: [
        `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`,
      ],
    });
    // The next one isn't optimized
    // This statement will invalidate the cache of fetched error events for all replayIds
    queryClient.invalidateQueries({
      queryKey: [`/organizations/${orgSlug}/replays-events-meta/`],
    });
  }, [orgSlug, replayId, projectSlug, queryClient]);

  const allStatuses = [
    enableReplayRecord ? fetchReplayStatus : undefined,
    enableAttachments ? fetchAttachmentsStatus : undefined,
    enableErrors ? fetchErrorsStatus : undefined,
    enableExtraErrors ? fetchExtraErrorsStatus : undefined,
    fetchPlatformErrorsStatus,
  ];

  const isError = allStatuses.includes('error');
  const isPending = allStatuses.includes('pending');
  const status = isError ? 'error' : isPending ? 'pending' : 'success';

  return useMemo(() => {
    const allErrors = errorPages
      .concat(extraErrorPages)
      .concat(platformErrorPages)
      .flatMap(page => page.data);
    return {
      attachments: attachmentPages.flat(2),
      errors: allErrors,
      fetchError: fetchReplayError ?? undefined,
      attachmentError: fetchAttachmentsError ?? undefined,
      isError,
      isPending,
      status,
      onRetry: clearQueryCache,
      projectSlug,
      replayRecord,
    };
  }, [
    errorPages,
    extraErrorPages,
    platformErrorPages,
    attachmentPages,
    fetchReplayError,
    fetchAttachmentsError,
    isError,
    isPending,
    status,
    clearQueryCache,
    projectSlug,
    replayRecord,
  ]);
}

export default useReplayData;
