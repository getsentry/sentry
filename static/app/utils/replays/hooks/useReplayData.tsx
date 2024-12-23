import {useCallback, useMemo, useRef} from 'react';

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
  attachments: unknown[];
  errors: ReplayError[];
  fetchError: undefined | RequestError;
  fetching: boolean;
  onRetry: () => void;
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
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
  const hasFetchedAttachments = useRef(false);
  const queryClient = useQueryClient();

  // Fetch every field of the replay. The TS type definition lists every field
  // that's available. It's easier to ask for them all and not have to deal with
  // partial types or nullable fields.
  // We're overfetching for sure.
  const {
    data: replayData,
    isFetching: isFetchingReplay,
    error: fetchReplayError,
  } = useApiQuery<{data: unknown}>([`/organizations/${orgSlug}/replays/${replayId}/`], {
    staleTime: Infinity,
    retry: false,
    enabled: Boolean(replayId),
  });
  const replayRecord = useMemo(
    () => (replayData?.data ? mapResponseToReplayRecord(replayData.data) : undefined),
    [replayData?.data]
  );

  const projectSlug = useReplayProjectSlug({replayRecord});

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

  const {
    pages: attachmentPages,
    isFetching: isFetchingAttachments,
    error: fetchAttachmentsError,
  } = useFetchParallelPages({
    enabled:
      !fetchReplayError &&
      Boolean(replayId) &&
      Boolean(projectSlug) &&
      Boolean(replayRecord),
    hits: replayRecord?.count_segments ?? 0,
    getQueryKey: getAttachmentsQueryKey,
    perPage: segmentsPerPage,
  });

  const getErrorsQueryKey = useCallback(
    ({cursor, per_page}): ApiQueryKey => {
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
            dataset: DiscoverDatasets.DISCOVER,
            start: replayRecord?.started_at.toISOString(),
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
    ({cursor, per_page}): ApiQueryKey => {
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
            dataset: DiscoverDatasets.ISSUE_PLATFORM,
            start: replayRecord?.started_at.toISOString(),
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

  const {
    pages: errorPages,
    isFetching: isFetchingErrors,
    getLastResponseHeader: lastErrorsResponseHeader,
  } = useFetchParallelPages<{data: ReplayError[]}>({
    enabled: !fetchReplayError && Boolean(projectSlug) && Boolean(replayRecord),
    hits: replayRecord?.count_errors ?? 0,
    getQueryKey: getErrorsQueryKey,
    perPage: errorsPerPage,
  });

  const linkHeader = lastErrorsResponseHeader?.('Link') ?? null;
  const links = parseLinkHeader(linkHeader);
  const {pages: extraErrorPages, isFetching: isFetchingExtraErrors} =
    useFetchSequentialPages<{data: ReplayError[]}>({
      enabled:
        !fetchReplayError &&
        !isFetchingErrors &&
        (!replayRecord?.count_errors || Boolean(links.next?.results)),
      initialCursor: links.next?.cursor,
      getQueryKey: getErrorsQueryKey,
      perPage: errorsPerPage,
    });

  const {pages: platformErrorPages, isFetching: isFetchingPlatformErrors} =
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

  return useMemo(() => {
    // This hook can enter a state where `fetching` below is false
    // before it is entirely ready (i.e. it has not fetched
    // attachemnts yet). This can cause downstream components to
    // think it is no longer fetching and will display an error
    // because there are no attachments. The below will require
    // that we have attempted to fetch an attachment once (or it
    // errors) before we toggle fetching state to false.
    hasFetchedAttachments.current =
      hasFetchedAttachments.current || isFetchingAttachments;

    const fetching =
      isFetchingReplay ||
      isFetchingAttachments ||
      isFetchingErrors ||
      isFetchingExtraErrors ||
      isFetchingPlatformErrors ||
      (!hasFetchedAttachments.current &&
        !fetchAttachmentsError &&
        Boolean(replayRecord?.count_segments));

    const allErrors = errorPages
      .concat(extraErrorPages)
      .concat(platformErrorPages)
      .flatMap(page => page.data);
    return {
      attachments: attachmentPages.flat(2),
      errors: allErrors,
      fetchError: fetchReplayError ?? undefined,
      fetching,
      onRetry: clearQueryCache,
      projectSlug,
      replayRecord,
    };
  }, [
    attachmentPages,
    clearQueryCache,
    errorPages,
    extraErrorPages,
    fetchReplayError,
    fetchAttachmentsError,
    isFetchingAttachments,
    isFetchingErrors,
    isFetchingExtraErrors,
    isFetchingPlatformErrors,
    isFetchingReplay,
    platformErrorPages,
    projectSlug,
    replayRecord,
  ]);
}

export default useReplayData;
