import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {inflate} from 'pako';

// import {IssueAttachment} from 'sentry/types';
// import {EventTransaction} from 'sentry/types/event';
import flattenListOfObjects from 'sentry/utils/replays/flattenListOfObjects';
import useReplayErrors from 'sentry/utils/replays/hooks/useReplayErrors';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySegment,
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
   * Are errors currently being fetched
   */
  isErrorsFetching: boolean;

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
   * The projectSlug and eventId concatenated together
   */
  eventSlug: string;

  /**
   * The organization slug
   */
  orgId: string;
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
  isErrorsFetching: true,
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
 * @param {orgId, eventSlug} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({eventSlug, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [state, setState] = useState<State>(INITIAL_STATE);

  const fetchEvent = useCallback(() => {
    return api.requestPromise(
      `/projects/${orgId}/${projectId}/replays/${eventId}`
    ) as Promise<{data: ReplayRecord}>;
  }, [api, orgId, projectId, eventId]);

  const fetchRRWebEvents = useCallback(async () => {
    // can we use 'count_sequences' instead of making another (N) calls to list the segments available
    const segments = (await api.requestPromise(
      `/projects/${orgId}/${projectId}/replays/${eventId}/recording-segments/`
    )) as {data: ReplaySegment[]};

    const attachments = await Promise.all(
      segments.data.map(async segment => {
        const response = await api.requestPromise(
          `/projects/${orgId}/${projectId}/replays/${eventId}/recording-segments/${segment.segment_id}/?download`,
          {
            includeAllArgs: true,
          }
        );

        // for non-compressed events, parse and return
        try {
          return mapRRWebAttachments(JSON.parse(response[0]));
        } catch (error) {
          // swallow exception.. if we can't parse it, it's going to be compressed
        }

        // for non-compressed events, parse and return
        try {
          // for compressed events, inflate the blob and map the events
          const responseBlob = await response[2]?.rawResponse.blob();
          const responseArray = (await responseBlob?.arrayBuffer()) as Uint8Array;
          const parsedPayload = JSON.parse(inflate(responseArray, {to: 'string'}));
          return mapRRWebAttachments(parsedPayload);
        } catch (error) {
          return {};
        }
      })
    );

    // ReplayAttachment[] => ReplayAttachment (merge each key of ReplayAttachment)
    return flattenListOfObjects(attachments);
  }, [api, eventId, orgId, projectId]);

  const {isLoading: isErrorsFetching, data: errors} = useReplayErrors({
    replayId: eventId,
  });

  useEffect(() => {
    if (!isErrorsFetching) {
      setState(prevState => ({
        ...prevState,
        fetching: prevState.fetching || isErrorsFetching,
        isErrorsFetching,
        errors,
      }));
    }
  }, [isErrorsFetching, errors]);

  const loadEvents = useCallback(async () => {
    setState(INITIAL_STATE);

    try {
      const [replayResponse, attachments] = await Promise.all([
        fetchEvent(),
        fetchRRWebEvents(),
      ]);

      setState(prev => ({
        ...prev,
        replayRecord: replayResponse.data,
        fetchError: undefined,
        fetching: prev.isErrorsFetching || false,
        rrwebEvents: attachments.recording,
        spans: attachments.replaySpans,
        breadcrumbs: attachments.breadcrumbs,
      }));
    } catch (error) {
      Sentry.captureException(error);
      setState({
        ...INITIAL_STATE,
        fetchError: error,
        fetching: false,
      });
    }
  }, [fetchEvent, fetchRRWebEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const replay = useMemo(() => {
    return ReplayReader.factory({
      replayRecord: state.replayRecord,
      errors: state.errors,
      rrwebEvents: state.rrwebEvents,
      breadcrumbs: state.breadcrumbs,
      spans: state.spans,
    });
  }, [
    state.replayRecord,
    state.rrwebEvents,
    state.breadcrumbs,
    state.spans,
    state.errors,
  ]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry: loadEvents,
    replay,
  };
}

export default useReplayData;
