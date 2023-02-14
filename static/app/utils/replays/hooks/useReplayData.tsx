import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import chunk from 'lodash/chunk';

import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
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
  const segments = responses.flatMap(_ => _);
  // Each segment includes an array of attachments
  const attachments = segments.flatMap(_ => _);
  return attachments;
}

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
    const baseUrl = `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`;

    const initPerPage = 50;
    const firstFourUrls = [
      `${baseUrl}?download&per_page=${initPerPage}&cursor=${initPerPage}:0:1`,
      `${baseUrl}?download&per_page=${initPerPage}&cursor=${initPerPage}:1:0`,
      `${baseUrl}?download&per_page=${initPerPage}&cursor=${initPerPage}:2:0`,
      `${baseUrl}?download&per_page=${initPerPage}&cursor=${initPerPage}:3:0`,
    ];

    // TODO(replay): fetch a count of how many `/recording-segments/` there are inside this replay,
    // and use that to parallelize the `while (next.results)` loop below.

    const parallelResponses = await Promise.allSettled(
      firstFourUrls.map(url =>
        api.requestPromise(url, {
          includeAllArgs: true,
        })
      )
    );

    const responses = parallelResponses.map(resp =>
      resp.status === 'fulfilled' ? resp.value[0] : []
    );

    setState(prev => ({
      ...prev,
      attachments: responsesToAttachments(responses),
      errors: prev.errors ?? [],
    }));

    const lastResponse = parallelResponses[firstFourUrls.length - 1];
    const [_lastData, _lastTextStatus, lastResp] =
      lastResponse.status === 'fulfilled' ? lastResponse.value : [];

    const segmentsPerPage = 100;
    const cursor = `${segmentsPerPage}:2:0`;
    const rootUrl = `${baseUrl}?download&per_page=${segmentsPerPage}`;
    const noNextPage = {href: rootUrl, results: false, cursor: ''};
    let next: ParsedHeader = lastResp
      ? lastResp.getResponseHeader('Link')
        ? {href: rootUrl, results: true, cursor}
        : noNextPage
      : noNextPage;

    // TODO(replay): It would be good to load the first page of results then
    // start to render the UI while the next N pages continue to get fetched in
    // the background.
    while (next.results) {
      const url = `${rootUrl}&cursor=${next.cursor}`;

      const [data, _textStatus, resp] = await api.requestPromise(url, {
        includeAllArgs: true,
      });

      setState(prev => ({
        ...prev,
        attachments: (prev.attachments ?? []).concat(responsesToAttachments(data)),
        errors: prev.errors ?? [],
      }));

      const links = parseLinkHeader(resp?.getResponseHeader('Link') ?? '');
      next = links.next;
    }
  }, [api, orgSlug, projectSlug, replayId]);

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

  const fetchReplayAndErrors = useCallback(async () => {
    const fetchedRecord = await fetchReplay();
    const mappedRecord = mapResponseToReplayRecord(fetchedRecord);
    setState(prev => ({
      ...prev,
      replayRecord: mappedRecord,
    }));

    await fetchErrors(mappedRecord);
  }, [fetchReplay, fetchErrors]);

  const loadEvents = useCallback(async () => {
    setState(INITIAL_STATE);

    try {
      await Promise.all([fetchReplayAndErrors(), fetchAllAttachments()]);

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
