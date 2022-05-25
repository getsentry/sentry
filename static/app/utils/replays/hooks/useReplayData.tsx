import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {eventWithTime} from 'rrweb/typings/types';

import {IssueAttachment} from 'sentry/types';
import {Event, EventTransaction} from 'sentry/types/event';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type State = {
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
   * The list of related `sentry-replay-event` objects that were captured during this `sentry-replay`
   */
  replayEvents: undefined | Event[];

  /**
   * The flattened list of rrweb events. These are stored as multiple attachments on the root replay object: the `event` prop.
   */
  rrwebEvents: undefined | eventWithTime[];
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

interface Result extends Pick<State, 'fetchError' | 'fetching'> {
  onRetry: () => void;
  replay: ReplayReader | null;
}

const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;

function isRRWebEventAttachment(attachment: IssueAttachment) {
  return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name);
}

const INITIAL_STATE: State = Object.freeze({
  event: undefined,
  fetchError: undefined,
  fetching: true,
  replayEvents: undefined,
  rrwebEvents: undefined,
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
        return JSON.parse(response).events as eventWithTime;
      })
    );
    return attachments.flat();
  }, [api, eventId, orgId, projectId]);

  const fetchReplayEvents = useCallback(async () => {
    const replayEventList = await api.requestPromise(
      `/organizations/${orgId}/eventsv2/`,
      {
        query: {
          statsPeriod: '14d',
          project: [],
          environment: [],
          field: ['timestamp', 'replayId'],
          sort: 'timestamp',
          per_page: 50,
          query: ['transaction:sentry-replay-event', `replayId:${eventId}`].join(' '),
        },
      }
    );

    return Promise.all(
      replayEventList.data.map(
        event =>
          api.requestPromise(
            `/organizations/${orgId}/events/${generateEventSlug(event)}/`
          ) as Promise<Event>
      )
    );
  }, [api, eventId, orgId]);

  const loadEvents = useCallback(async () => {
    setState(INITIAL_STATE);

    try {
      const [event, rrwebEvents, replayEvents] = await Promise.all([
        fetchEvent(),
        fetchRRWebEvents(),
        fetchReplayEvents(),
      ]);

      setState({
        event,
        fetchError: undefined,
        fetching: false,
        replayEvents,
        rrwebEvents,
      });
    } catch (error) {
      Sentry.captureException(error);
      setState({
        ...INITIAL_STATE,
        fetchError: error,
        fetching: false,
      });
    }
  }, [fetchEvent, fetchRRWebEvents, fetchReplayEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const replay = useMemo(
    () => ReplayReader.factory(state.event, state.rrwebEvents, state.replayEvents),
    [state.event, state.rrwebEvents, state.replayEvents]
  );

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry: loadEvents,
    replay,
  };
}

export default useReplayData;
