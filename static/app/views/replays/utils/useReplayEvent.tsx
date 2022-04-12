import {useCallback, useEffect, useState} from 'react';
import type {eventWithTime} from 'rrweb/typings/types';

import {IssueAttachment} from 'sentry/types';
import {Entry, Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import mergeBreadcrumbsEntries from './mergeBreadcrumbsEntries';
import mergeEventsWithSpans from './mergeEventsWithSpans';

type State = {
  /**
   * List of breadcrumbs
   */
  breadcrumbEntry: undefined | Entry;

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

  mergedReplayEvent: undefined | Event;

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

interface Result extends State {
  onRetry: () => void;
}

const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;
function isRRWebEventAttachment(attachment: IssueAttachment) {
  return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name);
}

function useReplayEvent({eventSlug, location, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [retry, setRetry] = useState(false);
  const [state, setState] = useState<State>({
    fetchError: undefined,
    fetching: true,
    breadcrumbEntry: undefined,
    event: undefined,
    replayEvents: undefined,
    rrwebEvents: undefined,
    mergedReplayEvent: undefined,
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
    replayEventsView.additionalConditions.addFilterValues('replayId', [eventId]);
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
    setRetry(false);
    setState({
      fetchError: undefined,
      fetching: true,

      breadcrumbEntry: undefined,
      event: undefined,
      replayEvents: undefined,
      rrwebEvents: undefined,
      mergedReplayEvent: undefined,
    });

    const [event, rrwebEvents, replayEvents] = await Promise.all([
      fetchEvent(),
      fetchRRWebEvents(),
      fetchReplayEvents(),
    ]);

    const breadcrumbEntry = mergeBreadcrumbsEntries(replayEvents || []);
    const mergedReplayEvent = mergeEventsWithSpans(replayEvents || []);

    setState({
      ...state,
      fetchError: undefined,
      fetching: false,
      event,
      mergedReplayEvent,
      replayEvents,
      rrwebEvents,
      breadcrumbEntry,
    });
  }

  useEffect(() => void loadEvents(), [orgId, eventSlug, retry]);

  const onRetry = useCallback(() => {
    setRetry(true);
  }, []);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry,

    breadcrumbEntry: state.breadcrumbEntry,
    event: state.event,
    replayEvents: state.replayEvents,
    rrwebEvents: state.rrwebEvents,
    mergedReplayEvent: state.mergedReplayEvent,
  };
}

export default useReplayEvent;
