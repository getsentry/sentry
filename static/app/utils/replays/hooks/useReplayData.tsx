import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {IssueAttachment} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplaySpan,
} from 'sentry/views/replays/types';

import flattenListOfObjects from '../flattenListOfObjects';

import useReplayErrors from './useReplayErrors';

type State = {
  breadcrumbs: undefined | ReplayCrumb[];

  /**
   * List of errors that occurred during replay
   */
  errors: undefined | ReplayError[];

  /**
   * The root replay event
   */
  event: undefined | EventTransaction;

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

const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;

function isRRWebEventAttachment(attachment: IssueAttachment) {
  return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name);
}

const INITIAL_STATE: State = Object.freeze({
  errors: undefined,
  event: undefined,
  fetchError: undefined,
  fetching: true,
  isErrorsFetching: true,
  rrwebEvents: undefined,
  spans: undefined,
  breadcrumbs: undefined,
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
 * @returns An object representing a unified result of the network reqeusts. Either a single `ReplayReader` data object or fetch errors.
 */
function useReplayData({eventSlug, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [state, setState] = useState<State>(INITIAL_STATE);

  const fetchEvent = useCallback(() => {
    return api.requestPromise(
      `/organizations/${orgId}/events/${eventSlug}/`
    ) as Promise<EventTransaction>;
  }, [api, orgId, eventSlug]);

  const fetchRRWebEvents = useCallback(async () => {
    const attachmentIds = (await api.requestPromise(
      `/projects/${orgId}/${projectId}/events/${eventId}/attachments/`
    )) as IssueAttachment[];
    const rrwebAttachmentIds = attachmentIds.filter(isRRWebEventAttachment);
    const attachments = await Promise.all(
      rrwebAttachmentIds.map(async attachment => {
        const response = await api.requestPromise(
          `/api/0/projects/${orgId}/${projectId}/events/${eventId}/attachments/${attachment.id}/?download`
        );
        return JSON.parse(response) as ReplayAttachment;
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
      const [event, attachments] = await Promise.all([fetchEvent(), fetchRRWebEvents()]);

      setState(prev => ({
        ...prev,
        event,
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
      event: state.event,
      errors: state.errors,
      rrwebEvents: state.rrwebEvents,
      breadcrumbs: state.breadcrumbs,
      spans: state.spans,
    });
  }, [state.event, state.rrwebEvents, state.breadcrumbs, state.spans, state.errors]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry: loadEvents,
    replay,
  };
}

export default useReplayData;
