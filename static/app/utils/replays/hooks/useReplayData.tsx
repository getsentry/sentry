import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import chunk from 'lodash/chunk';

import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

const SEGMENTS_PER_PAGE = 50; // p95 is 44 segments
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

/**
 * A react hook to load core replay data over the network.
 *
 * Core replay data includes:
 * 1. The root replay EventTransaction object
 *    - This includes `startTimestamp` and `tags` data
 * 2. Breadcrumb and Span data from all the related Event objects
 *    - Data is merged for consumption
 * 3. RRWeb payloads for the replayer video stream
 *    - TODO(replay): incrementally load the stream to speedup pageload
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

  const fetchAllAttachments = useCallback(async () => {
    const rootUrl = `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/?download&per_page=${SEGMENTS_PER_PAGE}`;
    const firstFourCursors = [
      `${SEGMENTS_PER_PAGE}:0:1`,
      `${SEGMENTS_PER_PAGE}:1:0`,
      `${SEGMENTS_PER_PAGE}:2:0`,
      `${SEGMENTS_PER_PAGE}:3:0`,
    ];
    const firstFourUrls = firstFourCursors.map(cursor => `${rootUrl}&cursor=${cursor}`);

    const parallelResponses = await Promise.allSettled(
      firstFourUrls.map(url =>
        api.requestPromise(url, {
          includeAllArgs: true,
        })
      )
    );

    const responses: any = parallelResponses.map(resp =>
      resp.status === 'fulfilled' ? resp.value[0] : []
    );

    const lastResponse = parallelResponses[firstFourCursors.length - 1];
    const [_lastData, _lastTextStatus, lastResp] =
      lastResponse.status === 'fulfilled' ? lastResponse.value : [];

    let next: ParsedHeader = lastResp
      ? parseLinkHeader(lastResp.getResponseHeader('Link') ?? '').next
      : {href: rootUrl, results: true, cursor: ''};

    // TODO(replay): It would be good to load the first page of results then
    // start to render the UI while the next N pages continue to get fetched in
    // the background.
    while (next.results) {
      const url = `${rootUrl}&cursor=${next.cursor}`;

      const [data, _textStatus, resp] = await api.requestPromise(url, {
        includeAllArgs: true,
      });
      responses.push(data);
      const links = parseLinkHeader(resp?.getResponseHeader('Link') ?? '');
      next = links.next;
    }

    // Each response returns an array of segments
    const segments = responses.flatMap(_ => _);
    // Each segment includes an array of attachments
    const attachments = segments.flatMap(_ => _);

    return attachments;
  }, [api, orgSlug, projectSlug, replayId]);

  const fetchErrors = useCallback(
    async (replayRecord: ReplayRecord) => {
      if (!replayRecord.errorIds.length) {
        return [];
      }

      // Clone the `finishedAt` time and bump it up one second because finishedAt
      // has the `ms` portion truncated, while replays-events-meta operates on
      // timestamps with `ms` attached. So finishedAt could be at time `12:00:00.000Z`
      // while the event is saved with `12:00:00.450Z`.
      const finishedAtClone = new Date(replayRecord.finishedAt);
      finishedAtClone.setSeconds(finishedAtClone.getSeconds() + 1);

      const chunks = chunk(replayRecord.errorIds, ERRORS_PER_PAGE);
      const responses = await Promise.allSettled(
        chunks.map(errorIds =>
          api.requestPromise(`/organizations/${orgSlug}/replays-events-meta/`, {
            query: {
              start: replayRecord.startedAt.toISOString(),
              end: finishedAtClone.toISOString(),
              query: `id:[${String(errorIds)}]`,
            },
          })
        )
      );

      return responses.flatMap(resp =>
        resp.status === 'fulfilled' ? resp.value.data : []
      );
    },
    [api, orgSlug]
  );

  const fetchReplayAndErrors = useCallback(async (): Promise<[ReplayRecord, any]> => {
    const fetchedRecord = await fetchReplay();
    const mappedRecord = mapResponseToReplayRecord(fetchedRecord);
    setState(prev => ({
      ...prev,
      replayRecord: mappedRecord,
    }));
    const fetchedErrors = await fetchErrors(mappedRecord);
    return [mappedRecord, fetchedErrors];
  }, [fetchReplay, fetchErrors]);

  const loadEvents = useCallback(async () => {
    setState(INITIAL_STATE);

    try {
      const [replayAndErrors, attachments] = await Promise.all([
        fetchReplayAndErrors(),
        fetchAllAttachments(),
      ]);
      const [replayRecord, errors] = replayAndErrors;

      setState(prev => ({
        ...prev,
        attachments,
        errors,
        fetchError: undefined,
        fetching: false,
        replayRecord,
      }));
    } catch (error) {
      Sentry.captureException(error);
      setState({
        ...INITIAL_STATE,
        fetchError: error,
        fetching: false,
      });
    }
  }, [fetchReplayAndErrors, fetchAllAttachments]);

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
