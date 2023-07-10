import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Client} from 'sentry/api';
import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useProjects from 'sentry/utils/useProjects';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type State = {
  /**
   * If any request returned an error then nothing is being returned
   */
  fetchError: undefined | RequestError;

  /**
   * If a fetch is underway for the requested root reply.
   * This includes fetched all the sub-resources like attachments and `sentry-replay-event`
   */
  fetchingAttachments: boolean;
  fetchingErrors: boolean;
  fetchingReplay: boolean;
};

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

interface Result {
  attachments: unknown[];
  errors: ReplayError[];
  fetchError: undefined | RequestError;
  fetching: boolean;
  onRetry: () => void;
  projectSlug: string | null;
  replayRecord: ReplayRecord | undefined;
}

const INITIAL_STATE: State = Object.freeze({
  fetchError: undefined,
  fetchingAttachments: true,
  fetchingErrors: true,
  fetchingReplay: true,
});

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
  const projects = useProjects();

  const api = useApi();

  const [state, setState] = useState<State>(INITIAL_STATE);
  const [attachments, setAttachments] = useState<unknown[]>([]);
  const attachmentMap = useRef<Map<string, unknown[]>>(new Map()); // Map keys are always iterated by insertion order
  const [errors, setErrors] = useState<ReplayError[]>([]);
  const [replayRecord, setReplayRecord] = useState<ReplayRecord>();

  const projectSlug = useMemo(() => {
    if (!replayRecord) {
      return null;
    }
    return projects.projects.find(p => p.id === replayRecord.project_id)?.slug ?? null;
  }, [replayRecord, projects.projects]);

  // Fetch every field of the replay. We're overfetching, not every field is used
  const fetchReplay = useCallback(async () => {
    const response = await api.requestPromise(makeFetchReplayApiUrl(orgSlug, replayId));
    const mappedRecord = mapResponseToReplayRecord(response.data);
    setReplayRecord(mappedRecord);
    setState(prev => ({...prev, fetchingReplay: false}));
  }, [api, orgSlug, replayId]);

  const fetchAttachments = useCallback(async () => {
    if (!replayRecord || !projectSlug) {
      return;
    }

    if (!replayRecord.count_segments) {
      setState(prev => ({...prev, fetchingAttachments: false}));
      return;
    }

    const pages = Math.ceil(replayRecord.count_segments / segmentsPerPage);
    const cursors = new Array(pages).fill(0).map((_, i) => `0:${segmentsPerPage * i}:0`);
    cursors.forEach(cursor => attachmentMap.current.set(cursor, []));

    await Promise.allSettled(
      cursors.map(cursor => {
        const promise = api.requestPromise(
          `/projects/${orgSlug}/${projectSlug}/replays/${replayRecord.id}/recording-segments/`,
          {
            query: {
              download: true,
              per_page: segmentsPerPage,
              cursor,
            },
          }
        );
        promise.then(response => {
          attachmentMap.current.set(cursor, response);
          const flattened = Array.from(attachmentMap.current.values()).flat(2);
          setAttachments(flattened);
        });
        return promise;
      })
    );
    setState(prev => ({...prev, fetchingAttachments: false}));
  }, [segmentsPerPage, api, orgSlug, replayRecord, projectSlug]);

  const fetchErrors = useCallback(async () => {
    if (!replayRecord) {
      return;
    }

    // Clone the `finished_at` time and bump it up one second because finishedAt
    // has the `ms` portion truncated, while replays-events-meta operates on
    // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
    // while the event is saved with `12:00:00.450Z`.
    const finishedAtClone = new Date(replayRecord.finished_at);
    finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

    const paginatedErrors = fetchPaginatedReplayErrors(api, {
      orgSlug,
      replayId: replayRecord.id,
      start: replayRecord.started_at,
      end: finishedAtClone,
      limit: errorsPerPage,
    });

    for await (const pagedResults of paginatedErrors) {
      setErrors(prev => [...prev, ...(pagedResults || [])]);
    }

    setState(prev => ({...prev, fetchingErrors: false}));
  }, [api, orgSlug, replayRecord, errorsPerPage]);

  const onError = useCallback(error => {
    Sentry.captureException(error);
    setState(prev => ({...prev, fetchError: error}));
  }, []);

  const loadData = useCallback(
    () => fetchReplay().catch(onError),
    [fetchReplay, onError]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (state.fetchError) {
      return;
    }
    fetchErrors().catch(onError);
  }, [state.fetchError, fetchErrors, onError]);

  useEffect(() => {
    if (state.fetchError) {
      return;
    }
    fetchAttachments().catch(onError);
  }, [state.fetchError, fetchAttachments, onError]);

  return {
    attachments,
    errors,
    fetchError: state.fetchError,
    fetching: state.fetchingAttachments || state.fetchingErrors || state.fetchingReplay,
    onRetry: loadData,
    projectSlug,
    replayRecord,
  };
}

function makeFetchReplayApiUrl(orgSlug: string, replayId: string) {
  return `/organizations/${orgSlug}/replays/${replayId}/`;
}

async function fetchReplayErrors(
  api: Client,
  {
    orgSlug,
    start,
    end,
    replayId,
    limit = 50,
    cursor = '0:0:0',
  }: {
    end: Date;
    orgSlug: string;
    replayId: string;
    start: Date;
    cursor?: string;
    limit?: number;
  }
) {
  return await api.requestPromise(`/organizations/${orgSlug}/replays-events-meta/`, {
    includeAllArgs: true,
    query: {
      start: start.toISOString(),
      end: end.toISOString(),
      query: `replayId:[${replayId}]`,
      per_page: limit,
      cursor,
    },
  });
}

async function* fetchPaginatedReplayErrors(
  api: Client,
  {
    orgSlug,
    start,
    end,
    replayId,
    limit = 50,
  }: {
    end: Date;
    orgSlug: string;
    replayId: string;
    start: Date;
    limit?: number;
  }
): AsyncGenerator<ReplayError[]> {
  function next(nextCursor: string) {
    return fetchReplayErrors(api, {
      orgSlug,
      replayId,
      start,
      end,
      limit,
      cursor: nextCursor,
    });
  }
  let cursor: undefined | ParsedHeader = {
    cursor: '0:0:0',
    results: true,
    href: '',
  };
  while (cursor && cursor.results) {
    const [{data}, , resp] = await next(cursor.cursor);
    const pageLinks = resp?.getResponseHeader('Link') ?? null;
    cursor = parseLinkHeader(pageLinks)?.next;
    yield data;
  }
}

export default useReplayData;
