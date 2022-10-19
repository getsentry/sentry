import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import parseLinkHeader, {ParsedHeader} from 'sentry/utils/parseLinkHeader';
import flattenListOfObjects from 'sentry/utils/replays/flattenListOfObjects';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

type State = {
  breadcrumbs: undefined | ReplayCrumb[];

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

  /**
   * The flattened list of rrweb events. These are stored as multiple attachments on the root replay object: the `event` prop.
   */
  rrwebEvents: undefined | RecordingEvent[];

  spans: undefined | ReplaySpan[];
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

// Errors if it is an interface
// See https://github.com/microsoft/TypeScript/issues/15300
type ReplayAttachment = {
  breadcrumbs: ReplayCrumb[];
  recording: RecordingEvent[];
  replaySpans: ReplaySpan[];
};

interface Result extends Pick<State, 'fetchError' | 'fetching'> {
  onRetry: () => void;
  replay: ReplayReader | null;
  replayRecord: ReplayRecord | undefined;
}

export function mapRRWebAttachments(unsortedReplayAttachments): ReplayAttachment {
  const replayAttachments: ReplayAttachment = {
    breadcrumbs: [],
    replaySpans: [],
    recording: [],
  };

  unsortedReplayAttachments.forEach(attachment => {
    if (attachment.data?.tag === 'performanceSpan') {
      replayAttachments.replaySpans.push(attachment.data.payload);
    } else if (attachment?.data?.tag === 'breadcrumb') {
      replayAttachments.breadcrumbs.push(attachment.data.payload);
    } else {
      replayAttachments.recording.push(attachment);
    }
  });

  return replayAttachments;
}

const INITIAL_STATE: State = Object.freeze({
  breadcrumbs: undefined,
  errors: undefined,
  fetchError: undefined,
  fetching: true,
  replayRecord: undefined,
  rrwebEvents: undefined,
  spans: undefined,
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

  const fetchAllRRwebEvents = useCallback(async () => {
    const rootUrl = `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/?download`;
    let next: ParsedHeader = {
      href: rootUrl,
      results: true,
      cursor: '',
    };

    const segmentRanges: any = [];
    // TODO(replay): It would be good to load the first page of results then
    // start to render the UI while the next N pages continue to get fetched in
    // the background.
    while (next.results) {
      const url = rootUrl + '&cursor=' + next.cursor;

      const [data, _textStatus, resp] = await api.requestPromise(url, {
        includeAllArgs: true,
      });
      segmentRanges.push(data);
      const links = parseLinkHeader(resp?.getResponseHeader('Link') ?? '');
      next = links.next;
    }

    const rrwebEvents = segmentRanges
      .flatMap(segment => segment)
      .flatMap(attachments => mapRRWebAttachments(attachments));

    return flattenListOfObjects(rrwebEvents);
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

      const response = await api.requestPromise(
        `/organizations/${orgSlug}/replays-events-meta/`,
        {
          query: {
            start: replayRecord.startedAt.toISOString(),
            end: finishedAtClone.toISOString(),
            query: `id:[${String(replayRecord.errorIds)}]`,
          },
        }
      );
      return response.data;
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
        fetchAllRRwebEvents(),
      ]);
      const [replayRecord, errors] = replayAndErrors;

      setState(prev => ({
        ...prev,
        breadcrumbs: attachments.breadcrumbs,
        errors,
        fetchError: undefined,
        fetching: false,
        replayRecord,
        rrwebEvents: attachments.recording,
        spans: attachments.replaySpans,
      }));
    } catch (error) {
      Sentry.captureException(error);
      setState({
        ...INITIAL_STATE,
        fetchError: error,
        fetching: false,
      });
    }
  }, [fetchReplayAndErrors, fetchAllRRwebEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const replay = useMemo(() => {
    return ReplayReader.factory({
      breadcrumbs: state.breadcrumbs,
      errors: state.errors,
      replayRecord: state.replayRecord,
      rrwebEvents: state.rrwebEvents,
      spans: state.spans,
    });
  }, [
    state.breadcrumbs,
    state.errors,
    state.replayRecord,
    state.rrwebEvents,
    state.spans,
  ]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry: loadEvents,
    replay,
    replayRecord: state.replayRecord,
  };
}

export default useReplayData;
