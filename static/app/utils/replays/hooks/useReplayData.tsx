import {useCallback, useMemo} from 'react';
import {
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/typesBase';
import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useFeedbackEvents} from 'sentry/utils/replays/hooks/useFeedbackEvents';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type {RawReplayError} from 'sentry/utils/replays/types';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

export function replayRecordApiOptions({
  organizationIdOrSlug,
  replayId,
}: {
  organizationIdOrSlug: string;
  replayId: string | undefined;
}) {
  return apiOptions.as<{data: unknown}>()(
    '/organizations/$organizationIdOrSlug/replays/$replayId/',
    {
      path: replayId ? {organizationIdOrSlug, replayId} : skipToken,
      staleTime: Infinity,
    }
  );
}

export function replayAttachmentsApiOptions({
  organizationIdOrSlug,
  projectIdOrSlug,
  replayId,
  query,
}: {
  organizationIdOrSlug: string;
  projectIdOrSlug: string;
  replayId: string;
  query?: {cursor: string; download: boolean; per_page: number};
}) {
  return apiOptions.as<unknown>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/$replayId/recording-segments/',
    {
      path: {
        organizationIdOrSlug,
        projectIdOrSlug,
        replayId,
      },
      query,
      staleTime: Infinity,
    }
  );
}

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

const REPLAY_ERROR_FIELDS = [
  'error.type',
  'id',
  'issue',
  'issue.id',
  'level',
  'project.name',
  'timestamp_ms',
  'title',
] as const;

const EMPTY_PAGES: Array<{data: RawReplayError[]}> = [];

interface Result {
  attachmentError: undefined | Error[];
  attachments: unknown[];
  errors: RawReplayError[];
  fetchError: undefined | Error;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
  status: 'pending' | 'error' | 'success';
  feedbackEvents?: FeedbackEvent[];
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
export function useReplayData({
  replayId,
  orgSlug,
  errorsPerPage = 50,
  segmentsPerPage = 100,
}: Options): Result {
  const queryClient = useQueryClient();

  // Fetch every field of the replay. The TS type definition lists every field
  // that's available. It's easier to ask for them all and not have to deal with
  // partial types or nullable fields.
  // We're overfetching for sure.
  const {
    data: replayData,
    status: fetchReplayStatus,
    error: fetchReplayError,
  } = useQuery({
    ...replayRecordApiOptions({organizationIdOrSlug: orgSlug, replayId}),
    retry: false,
  });
  const replayRecord = useMemo(
    () => (replayData?.data ? mapResponseToReplayRecord(replayData.data) : undefined),
    [replayData?.data]
  );

  const projectSlug = useReplayProjectSlug({replayRecord});

  const getAttachmentsQueryOptions = useCallback(
    ({cursor, per_page}: {cursor: string; per_page: number}) =>
      replayAttachmentsApiOptions({
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug!,
        replayId: replayId!,
        query: {download: true, per_page, cursor},
      }),
    [orgSlug, projectSlug, replayId]
  );

  const enableAttachments =
    !fetchReplayError &&
    Boolean(replayId) &&
    Boolean(projectSlug) &&
    Boolean(replayRecord);

  const attachmentCursors = Array.from(
    {length: Math.ceil((replayRecord?.count_segments ?? 0) / segmentsPerPage)},
    (_, i) => `0:${segmentsPerPage * i}:0`
  );

  const {
    pages: attachmentPages,
    status: fetchAttachmentsStatus,
    errors: fetchAttachmentsError,
  } = useQueries({
    queries: enableAttachments
      ? attachmentCursors.map(cursor =>
          getAttachmentsQueryOptions({cursor, per_page: segmentsPerPage})
        )
      : [],
    combine: results => ({
      pages: results.map(r => r.data).filter(defined),
      status: results.some(r => r.status === 'error')
        ? 'error'
        : results.some(r => r.status === 'pending')
          ? 'pending'
          : 'success',
      errors: results.map(r => r.error).filter(defined),
    }),
  });

  const getErrorsQueryOptions = useCallback(
    ({cursor, per_page}: {cursor: string; per_page: number}) => {
      // Bump `finished_at` up one second because it's truncated to whole
      // seconds, while events carry ms precision — e.g. finished_at of
      // `12:00:00.000Z` could miss an event stored at `12:00:00.450Z`.
      const finishedAtClone = new Date(replayRecord?.finished_at ?? '');
      finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

      return apiOptions.as<{data: RawReplayError[]}>()(
        '/organizations/$organizationIdOrSlug/events/',
        {
          path: {organizationIdOrSlug: orgSlug},
          query: {
            referrer: 'replay_details',
            dataset: DiscoverDatasets.ERRORS,
            field: REPLAY_ERROR_FIELDS,
            start: replayRecord?.started_at?.toISOString() ?? '',
            end: finishedAtClone.toISOString(),
            project: ALL_ACCESS_PROJECTS,
            query: `replayId:[${replayRecord?.id}]`,
            per_page,
            cursor,
          },
          staleTime: Infinity,
        }
      );
    },
    [orgSlug, replayRecord]
  );

  const errorCursors = Array.from(
    {length: Math.ceil((replayRecord?.count_errors ?? 0) / errorsPerPage)},
    (_, i) => `0:${errorsPerPage * i}:0`
  );

  const enableErrors = Boolean(replayRecord) && Boolean(projectSlug);
  const {
    pages: errorPages,
    status: fetchErrorsStatus,
    lastLinkHeader,
  } = useQueries({
    queries: enableErrors
      ? errorCursors.map(cursor =>
          queryOptions({
            ...getErrorsQueryOptions({
              cursor,
              per_page: errorsPerPage,
            }),
            select: selectJsonWithHeaders,
          })
        )
      : [],
    combine: results => ({
      pages: results.map(r => r.data?.json).filter(defined),
      status: results.some(r => r.status === 'error')
        ? 'error'
        : results.some(r => r.status === 'pending')
          ? 'pending'
          : 'success',
      lastLinkHeader: parseLinkHeader(results.at(-1)?.data?.headers.Link ?? null),
    }),
  });

  const enableExtraErrors =
    Boolean(replayRecord) &&
    (!replayRecord?.count_errors || Boolean(lastLinkHeader.next?.results)) &&
    fetchErrorsStatus === 'success';

  const replayEnd = getReplayEndTimestamp(replayRecord);

  const extraErrorsResult = useInfiniteQuery({
    ...apiOptions.asInfinite<{data: RawReplayError[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: enableExtraErrors ? {organizationIdOrSlug: orgSlug} : skipToken,
        query: {
          referrer: 'replay_details',
          dataset: DiscoverDatasets.ERRORS,
          field: REPLAY_ERROR_FIELDS,
          start: replayRecord?.started_at?.toISOString() ?? '',
          end: replayEnd,
          project: ALL_ACCESS_PROJECTS,
          query: `replayId:[${replayRecord?.id}]`,
          per_page: errorsPerPage,
          cursor: lastLinkHeader.next?.cursor ?? '0:0:0',
        },
        staleTime: Infinity,
      }
    ),
    select: data => data.pages.map(p => p.json),
  });
  useFetchAllPages({result: extraErrorsResult});
  const extraErrorPages = extraErrorsResult.data ?? EMPTY_PAGES;
  const fetchExtraErrorsStatus = extraErrorsResult.status;

  const platformErrorsResult = useInfiniteQuery({
    ...apiOptions.asInfinite<{data: RawReplayError[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: replayRecord ? {organizationIdOrSlug: orgSlug} : skipToken,
        query: {
          referrer: 'replay_details',
          dataset: DiscoverDatasets.ISSUE_PLATFORM,
          field: REPLAY_ERROR_FIELDS,
          start: replayRecord?.started_at?.toISOString() ?? '',
          end: replayEnd,
          project: ALL_ACCESS_PROJECTS,
          query: `replayId:[${replayRecord?.id}]`,
          per_page: errorsPerPage,
          cursor: '0:0:0',
        },
        staleTime: Infinity,
      }
    ),
    select: data => data.pages.map(p => p.json),
  });
  useFetchAllPages({result: platformErrorsResult});
  const platformErrorPages = platformErrorsResult.data ?? EMPTY_PAGES;
  const fetchPlatformErrorsStatus = platformErrorsResult.status;

  const clearQueryCache = useCallback(() => {
    if (!replayId) {
      return;
    }
    queryClient.invalidateQueries(
      replayRecordApiOptions({organizationIdOrSlug: orgSlug, replayId})
    );
    if (projectSlug) {
      queryClient.invalidateQueries(
        replayAttachmentsApiOptions({
          organizationIdOrSlug: orgSlug,
          projectIdOrSlug: projectSlug,
          replayId,
        })
      );
    }
    const eventsUrl = getApiUrl('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: orgSlug},
    });

    // Invalidate fetched replay error events for all replayIds. Narrow to
    // `referrer=replay_details` so unrelated /events/ queries aren't refetched.
    queryClient.invalidateQueries({
      predicate: query => {
        const queryKey = safeParseQueryKey(query.queryKey);
        if (!queryKey) {
          return false;
        }
        return (
          queryKey.url === eventsUrl &&
          queryKey.options?.query?.referrer === 'replay_details'
        );
      },
    });
  }, [orgSlug, replayId, projectSlug, queryClient]);

  const {allErrors, feedbackEventIds} = useMemo(() => {
    const errors = [...errorPages, ...extraErrorPages, ...platformErrorPages].flatMap(
      page => page.data
    );

    const feedbackIds = errors
      ?.filter(error => error?.title.includes('User Feedback'))
      .map(error => error.id);

    return {allErrors: errors, feedbackEventIds: feedbackIds};
  }, [errorPages, extraErrorPages, platformErrorPages]);

  const {
    feedbackEvents: rawFeedbackEvents,
    isPending: feedbackEventsPending,
    isError: feedbackEventsError,
  } = useFeedbackEvents({
    feedbackEventIds: feedbackEventIds ?? [],
    projectId: replayRecord?.project_id,
  });

  // stabilize feedbackEvents to prevent unnecessary re-renders.
  // we don't care about reordering and feedback events can't be updated.
  // if a new feedback is submitted, then the length will increase, which is
  // the only thing we care about.
  const feedbackEvents = useMemo(() => {
    return rawFeedbackEvents;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawFeedbackEvents?.length]);

  const allStatuses = [
    replayId ? fetchReplayStatus : undefined,
    enableAttachments ? fetchAttachmentsStatus : undefined,
    enableErrors ? fetchErrorsStatus : undefined,
    enableExtraErrors ? fetchExtraErrorsStatus : undefined,
    replayRecord ? fetchPlatformErrorsStatus : undefined,
  ];

  const isError = allStatuses.includes('error') || feedbackEventsError;
  const isPending = allStatuses.includes('pending') || feedbackEventsPending;
  const status = isError ? 'error' : isPending ? 'pending' : 'success';

  return useMemo(() => {
    return {
      attachments: attachmentPages.flat(2),
      errors: allErrors,
      fetchError: fetchReplayError ?? undefined,
      attachmentError: fetchAttachmentsError?.length ? fetchAttachmentsError : undefined,
      feedbackEvents,
      isError,
      isPending,
      status,
      onRetry: clearQueryCache,
      projectSlug,
      replayRecord,
    };
  }, [
    attachmentPages,
    fetchReplayError,
    fetchAttachmentsError,
    feedbackEvents,
    isError,
    isPending,
    status,
    clearQueryCache,
    projectSlug,
    replayRecord,
    allErrors,
  ]);
}

function getReplayEndTimestamp(replayRecord: ReplayRecord | undefined): string {
  if (!replayRecord?.finished_at) {
    return '';
  }
  const d = new Date(replayRecord.finished_at);
  d.setSeconds(d.getSeconds() + 1);
  return d.toISOString();
}
