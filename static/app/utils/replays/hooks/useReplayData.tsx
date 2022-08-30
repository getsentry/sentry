import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {inflate} from 'pako';

import type {ResponseMeta} from 'sentry/api';
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

  const fetchSegmentList = useCallback(async () => {
    const response = await api.requestPromise(
      `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`
    );
    return response.data as ReplaySegment[];
  }, [api, orgSlug, projectSlug, replayId]);

  const fetchRRWebEvents = useCallback(
    async (segmentIds: number[]) => {
      const attachments = await Promise.all(
        segmentIds.map(async segmentId => {
          const response = await api.requestPromise(
            `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/${segmentId}/?download`,
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
    [api, replayId, orgSlug, projectSlug]
  );

  const fetchErrors = useCallback(
    async (replayRecord: ReplayRecord) => {
      if (!replayRecord.errorIds.length) {
        return [];
      }

      const response = await api.requestPromise(`/organizations/${orgSlug}/events/`, {
        query: {
          field: ['id', 'error.value', 'timestamp', 'error.type', 'issue.id'],
          projects: [-1],
          start: replayRecord.startedAt.toISOString(),
          end: replayRecord.finishedAt.toISOString(),
          query: `id:[${String(replayRecord.errorIds)}]`,
          referrer: 'api.replay.details-page',
        },
      });
      return response.data;
    },
    [api, orgSlug]
  );

  const loadEvents = useCallback(async () => {
    setState(INITIAL_STATE);

    try {
      const [record, segments] = await Promise.all([fetchReplay(), fetchSegmentList()]);
      const replayRecord = mapResponseToReplayRecord(record);

      // TODO(replays): Something like `range(record.countSegments)` could work
      // once we make sure that segments have sequential id's and are not dropped.
      const segmentIds = segments.map(segment => segment.segmentId);

      const [attachments, errors] = await Promise.all([
        fetchRRWebEvents(segmentIds),
        fetchErrors(replayRecord),
      ]);

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
  }, [fetchReplay, fetchSegmentList, fetchRRWebEvents, fetchErrors]);

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
  };
}

export default useReplayData;
