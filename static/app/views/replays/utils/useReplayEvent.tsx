import {useEffect, useState} from 'react';
import type RRWebPlayer from 'rrweb-player';

import {IssueAttachment} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

export type RRWebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];

type State = {
  // initiallyLoaded: boolean;
  /**
   * The root replay event
   */
  event: undefined | Event;
  fetchError: undefined | RequestError;

  fetching: boolean;
  replayEvents: undefined | Event[];
  rrwebEvents: undefined | RRWebEvents;
};

type Options = {
  /**
   * When provided, fetches specified replay event by slug
   */
  eventSlug: string;

  /**
   *
   */
  location: any;

  /**
   *
   */
  orgId: string;
};

type Result = {
  // /**
  //  * The snapshots/incremental rrweb data that constitutes the video timeline
  //  */
  // rrwebEvents: RRWebEvents;
  // /**
  //  * The Sentry events, errors and transactions, that were captured during this replay session
  //  */
  // transactions: Event[];
} & Pick<State, 'fetchError' | 'fetching' | 'event' | 'rrwebEvents' | 'replayEvents'>;

const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;
function isRRWebEventAttachment(attachment: IssueAttachment) {
  return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name);
}

function useReplayEvent({eventSlug, location, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [state, setState] = useState<State>({
    fetchError: undefined,
    fetching: false,
    event: undefined,
    replayEvents: undefined,
    rrwebEvents: undefined,
  });

  function fetchEvent() {
    return api.requestPromise(
      `/organizations/${orgId}/events/${eventSlug}/`
    ) as Promise<Event>;
  }

  function fetchRRWebEvents() {
    return api
      .requestPromise(`/projects/${orgId}/${projectId}/events/${eventId}/attachments/`)
      .then(attachments =>
        Promise.all(
          attachments.filter(isRRWebEventAttachment).map(attachment =>
            api
              .requestPromise(
                `/api/0/projects/${orgId}/${projectId}/events/${eventId}/attachments/${attachment.id}/?download`
              )
              .then(resp => JSON.parse(resp))
              .then(json => json.events)
          )
        )
      )
      .then(attachments => attachments.flat()) as Promise<RRWebEvents>;
  }

  function fetchReplayEvents() {
    const replayEventsView = EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: ['timestamp', 'replayId'],
      orderby: 'timestamp',
      projects: [],
      range: '14d',
      query: `transaction:sentry-replay-event`,
    });
    replayEventsView.additionalConditions.addFilterValues('rootReplayId', [eventId]);
    const replayEventsQuery = replayEventsView.getEventsAPIPayload(location);

    return api
      .requestPromise(`/organizations/${orgId}/eventsv2/`, {
        query: replayEventsQuery,
      })
      .then(replayEventList =>
        Promise.all(
          replayEventList.data.map(event =>
            api.requestPromise(
              `/organizations/${orgId}/events/${generateEventSlug(event)}/`
            )
          )
        )
      ) as Promise<Event[]>;
  }

  async function loadEvents() {
    // console.log('setting event = null');
    setState({
      fetchError: undefined,
      fetching: true,

      event: undefined,
      replayEvents: undefined,
      rrwebEvents: undefined,
    });
    try {
      const [event, rrwebEvents, replayEvents] = await Promise.all([
        fetchEvent(),
        fetchRRWebEvents(),
        fetchReplayEvents(),
      ]);

      setState({
        ...state,
        fetchError: undefined,
        fetching: false,
        event,
        replayEvents,
        rrwebEvents,
      });
    } catch (error) {
      setState({
        fetchError: error,
        fetching: false,

        event: undefined,
        replayEvents: undefined,
        rrwebEvents: undefined,
      });
    }
  }

  useEffect(() => void loadEvents(), [orgId, eventSlug]);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,

    event: state.event,
    replayEvents: state.replayEvents,
    rrwebEvents: state.rrwebEvents,
  };
}

export default useReplayEvent;
