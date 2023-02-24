import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import chunk from 'lodash/chunk';

import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

const ERRORS_PER_PAGE = 50; // Need to make sure the url is not too large

type State = {
  attachments: undefined | unknown[];

  /**
   * List of errors that occurred during replay
   */
  errors: undefined | ReplayError[];

  /**
   * If any request returned an error then nothing is being returned
   */
  fetchError: undefined | RequestError;

  /**
   * If a fetch is underway for the requested root reply.
   * This includes fetched all the sub-resources like attachments and `sentry-replay-event`
   */
  fetching: boolean;

  /**
   * The root replay event
   */
  replayRecord: undefined | ReplayRecord;
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
};

interface Result extends Pick<State, 'fetchError' | 'fetching'> {
  onRetry: () => void;
  replay: ReplayReader | null;
  replayRecord: ReplayRecord | undefined;
}

const INITIAL_STATE: State = Object.freeze({
  attachments: undefined,
  errors: undefined,
  fetchError: undefined,
  fetching: true,
  replayRecord: undefined,
});

function responsesToAttachments(responses: Array<unknown>) {
  // Each response returns an array of segments
  // Each segment includes an array of attachments
  // Therefore we flatten 2 levels deep
  return responses.flat(2);
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
 * @param {orgSlug, replaySlug} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({replaySlug, orgSlug}: Options): Result {
  const [projectSlug, replayId] = replaySlug.split(':');

  const api = useApi();
  const [state, setState] = useState<State>(INITIAL_STATE);

  // Fetch every field of the replay. We're overfetching, not every field is needed
  const fetchReplay = useCallback(async () => {
    const response = await api.requestPromise(
      `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/`
    );
    return response.data;
  }, [api, orgSlug, projectSlug, replayId]);

  const fetchAttachments = useCallback(
    async (replayRecord: ReplayRecord) => {
      if (!replayRecord.count_segments) {
        return;
      }

      const baseUrl = `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`;
      const perPage = 100;

      const pages = Math.ceil(replayRecord.count_segments / 100);
      const cursors = new Array(pages)
        .fill(0)
        .map((_, i) => `${perPage}:${i}:${i === 0 ? 1 : 0}`);

      await Promise.allSettled(
        cursors.map(cursor => {
          const promise = api.requestPromise(
            `${baseUrl}?download&per_page=${perPage}&cursor=${cursor}`
          );
          promise.then(response => {
            const attachments = responsesToAttachments([response]);
            setState(prev => ({
              ...prev,
              attachments: (prev.attachments ?? []).concat(attachments),
              errors: prev.errors ?? [],
            }));
          });
          return promise;
        })
      );
    },
    [api, orgSlug, projectSlug, replayId]
  );

  const fetchErrors = useCallback(
    async (replayRecord: ReplayRecord) => {
      if (!replayRecord.error_ids.length) {
        return;
      }

      // Clone the `finished_at` time and bump it up one second because finishedAt
      // has the `ms` portion truncated, while replays-events-meta operates on
      // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
      // while the event is saved with `12:00:00.450Z`.
      const finishedAtClone = new Date(replayRecord.finished_at);
      finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

      const chunks = chunk(replayRecord.error_ids, ERRORS_PER_PAGE);
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
            setState(prev => {
              if (!prev.attachments?.length) {
                return prev;
              }
              return {
                ...prev,
                errors: (prev.errors ?? []).concat(response.data),
              };
            });
          });
          return promise;
        })
      );
    },
    [api, orgSlug]
  );

  const fetchAll = useCallback(async () => {
    const fetchedRecord = await fetchReplay();
    const mappedRecord = mapResponseToReplayRecord(fetchedRecord);
    setState(prev => ({
      ...prev,
      replayRecord: mappedRecord,
    }));

    await Promise.all([fetchAttachments(mappedRecord), fetchErrors(mappedRecord)]);
  }, [fetchReplay, fetchAttachments, fetchErrors]);

  const loadEvents = useCallback(async () => {
    setState(INITIAL_STATE);

    try {
      await fetchAll();

      setState(prev => ({
        ...prev,
        fetching: false,
      }));
    } catch (error) {
      Sentry.captureException(error);
      setState({
        ...INITIAL_STATE,
        fetchError: error,
        fetching: false,
      });
    }
  }, [fetchAll]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const replay = useMemo(() => {
    return ReplayReader.factory({
      attachments: state.attachments,
      errors: state.errors,
      replayRecord: state.replayRecord,
    });
  }, [state.attachments, state.errors, state.replayRecord]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry: loadEvents,
    replay,
    replayRecord: state.replayRecord,
  };
}

export default useReplayData;
