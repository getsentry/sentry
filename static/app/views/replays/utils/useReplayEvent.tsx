import {useEffect, useState} from 'react';
import type {eventWithTime} from 'rrweb/typings/types';

import {IssueAttachment} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type State = {
  /**
   * The root replay event
   */
  event: undefined | Event;

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

interface Result extends State {}

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

  async function fetchRRWebEvents() {
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
  }

  async function fetchReplayEvents() {
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

    const replayEventList = await api.requestPromise(
      `/organizations/${orgId}/eventsv2/`,
      {
        query: replayEventsQuery,
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
  }

  async function loadEvents() {
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
