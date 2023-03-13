import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import chunk from 'lodash/chunk';

import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
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
   * The projectSlug and replayId concatenated together
   */
  replaySlug: string;

  /**
   * Default: 50
   * You can override this for testing
   *
   * Be mindful that the list of error-ids will appear in the GET request url,
   * so don't make the url string too large!
   */
  errorsPerPage?: number;
  /**
   * Default: 100
   * You can override this for testing
   */
  segmentsPerPage?: number;
};

interface Result {
  fetchError: undefined | RequestError;
  fetching: boolean;
  onRetry: () => void;
  replay: ReplayReader | null;
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
 * @param {orgSlug, replaySlug} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({
  replaySlug,
  orgSlug,
  errorsPerPage = 50,
  segmentsPerPage = 100,
}: Options): Result {
  const [projectSlug, replayId] = replaySlug.split(':');

  const api = useApi();

  const [state, setState] = useState<State>(INITIAL_STATE);
  const [attachments, setAttachments] = useState<unknown[]>([]);
  const [errors, setErrors] = useState<ReplayError[]>([]);
  const [replayRecord, setReplayRecord] = useState<ReplayRecord>();

  // Fetch every field of the replay. We're overfetching, not every field is used
  const fetchReplay = useCallback(async () => {
    const response = await api.requestPromise(
      `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/`
    );
    const mappedRecord = mapResponseToReplayRecord(response.data);
    setReplayRecord(mappedRecord);
    setState(prev => ({...prev, fetchingReplay: false}));
  }, [api, orgSlug, projectSlug, replayId]);

  const fetchAttachments = useCallback(async () => {
    if (!replayRecord) {
      return;
    }

    if (!replayRecord.count_segments) {
      setState(prev => ({...prev, fetchingAttachments: false}));
      return;
    }

    const pages = Math.ceil(replayRecord.count_segments / segmentsPerPage);
    const cursors = new Array(pages)
      .fill(0)
      .map((_, i) => `${segmentsPerPage}:${i}:${i === 0 ? 1 : 0}`);

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
          setAttachments(prev => (prev ?? []).concat(...response));
        });
        return promise;
      })
    );
    setState(prev => ({...prev, fetchingAttachments: false}));
  }, [segmentsPerPage, api, orgSlug, projectSlug, replayRecord]);

  const fetchErrors = useCallback(async () => {
    if (!replayRecord) {
      return;
    }

    if (!replayRecord.error_ids.length) {
      setState(prev => ({...prev, fetchingErrors: false}));
      return;
    }

    // Clone the `finished_at` time and bump it up one second because finishedAt
    // has the `ms` portion truncated, while replays-events-meta operates on
    // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
    // while the event is saved with `12:00:00.450Z`.
    const finishedAtClone = new Date(replayRecord.finished_at);
    finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

    const chunks = chunk(replayRecord.error_ids, errorsPerPage);
    await Promise.allSettled(
      chunks.map(errorIds => {
        const promise = api.requestPromise(
          `/organizations/${orgSlug}/replays-events-meta/`,
          {
            query: {
              start: replayRecord.started_at.toISOString(),
              end: finishedAtClone.toISOString(),
              query: `id:[${String(errorIds)}]`,
            },
          }
        );
        promise.then(response => {
          setErrors(prev => (prev ?? []).concat(response.data));
        });
        return promise;
      })
    );
    setState(prev => ({...prev, fetchingErrors: false}));
  }, [errorsPerPage, api, orgSlug, replayRecord]);

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

  const replay = useMemo(() => {
    return ReplayReader.factory({
      attachments,
      errors,
      replayRecord,
    });
  }, [attachments, errors, replayRecord]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetchingAttachments || state.fetchingErrors || state.fetchingReplay,
    onRetry: loadData,
    replay,
    replayRecord,
  };
}

export default useReplayData;
