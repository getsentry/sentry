import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import range from 'lodash/range';
import {inflate} from 'pako';

import type {ResponseMeta} from 'sentry/api';
import flattenListOfObjects from 'sentry/utils/replays/flattenListOfObjects';
import useMapResponseToReplayRecord from 'sentry/utils/replays/hooks/useMapResponseToReplayRecord';
import useReplayErrors from 'sentry/utils/replays/hooks/useReplayErrors';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  // ReplaySegment,
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
   * The organization slug
   */

  orgId: string;
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

async function decompressSegmentData(
  data: any,
  _textStatus: string | undefined,
  resp: ResponseMeta | undefined
) {
  // for non-compressed events, parse and return
  try {
    return mapRRWebAttachments(JSON.parse(data));
  } catch (error) {
    // swallow exception.. if we can't parse it, it's going to be compressed
  }

  // for non-compressed events, parse and return
  try {
    // for compressed events, inflate the blob and map the events
    const responseBlob = await resp?.rawResponse.blob();
    const responseArray = (await responseBlob?.arrayBuffer()) as Uint8Array;
    const parsedPayload = JSON.parse(inflate(responseArray, {to: 'string'}));
    return mapRRWebAttachments(parsedPayload);
  } catch (error) {
    return {};
  }
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
 * @param {orgId, replaySlug} Where to find the root replay event
 * @returns An object representing a unified result of the network requests. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({replaySlug, orgId}: Options): Result {
  const [projectId, replayId] = replaySlug.split(':');

  const api = useApi();
  const mapResponseToReplayRecord = useMapResponseToReplayRecord();
  const [state, setState] = useState<State>(INITIAL_STATE);

  // Fetch every field of the replay. We're overfetching, not every field is needed
  const fetchReplay = useCallback(async () => {
    const response = await api.requestPromise(
      `/projects/${orgId}/${projectId}/replays/${replayId}/`
    );
    return response.data;
  }, [api, orgId, projectId, replayId]);

  const fetchRRWebEvents = useCallback(
    async (segmentIds: number[]) => {
      const attachments = await Promise.all(
        segmentIds.map(async segmentId => {
          const response = await api.requestPromise(
            `/projects/${orgId}/${projectId}/replays/${replayId}/recording-segments/${segmentId}/?download`,
            {
              includeAllArgs: true,
            }
          );

          return decompressSegmentData(...response);
        })
      );

      // ReplayAttachment[] => ReplayAttachment (merge each key of ReplayAttachment)
      return flattenListOfObjects(attachments);
    },
    [api, replayId, orgId, projectId]
  );

  const {isLoading: isErrorsFetching, data: errors} = useReplayErrors({
    replayId,
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
      const record = await fetchReplay();

      // Instead of fetching the list of segments from the segment list endpoint
      // we're going to execute `N=record.countSegments` requests and assume that
      // all segmentId's exist.
      // `/projects/${orgId}/${projectId}/replays/${replayId}/recording-segments/`
      const attachments = await fetchRRWebEvents(range(record.countSegments));

      setState(prev => ({
        ...prev,
        replayRecord: mapResponseToReplayRecord(record),
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
  }, [fetchReplay, fetchRRWebEvents, mapResponseToReplayRecord]);

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
