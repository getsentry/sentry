import {useCallback, useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import type {eventWithTime} from 'rrweb/typings/types';

import {MemorySpanType} from 'sentry/components/events/interfaces/spans/types';
import {IssueAttachment} from 'sentry/types';
import {Entry, Event, EventTransaction} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import ReplayReader from 'sentry/utils/replays/replayReader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

import createHighlightEvents from './createHighlightEvents';
import mergeAndSortEvents from './mergeAndSortEvents';
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

  memorySpans: undefined | MemorySpanType[];

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
  replay: ReplayReader | null;
}

const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;

function isRRWebEventAttachment(attachment: IssueAttachment) {
  return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name);
}

const INITIAL_STATE: State = Object.freeze({
  fetchError: undefined,
  fetching: true,
  breadcrumbEntry: undefined,
  event: undefined,
  replayEvents: undefined,
  rrwebEvents: undefined,
  mergedReplayEvent: undefined,
  memorySpans: undefined,
});

function useReplayEvent({eventSlug, location, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [retry, setRetry] = useState(false);
  const [state, setState] = useState<State>(INITIAL_STATE);

  function fetchEvent() {
    return api.requestPromise(
      `/organizations/${orgId}/events/${eventSlug}/`
    ) as Promise<EventTransaction>;
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
      ...INITIAL_STATE,
    });

    try {
      const [event, rrwebEvents, replayEvents] = await Promise.all([
        fetchEvent(),
        fetchRRWebEvents(),
        fetchReplayEvents(),
      ]);

      const breadcrumbEntry = mergeBreadcrumbsEntries(replayEvents || [], event);
      const mergedReplayEvent = mergeEventsWithSpans(replayEvents || []);
      const memorySpans =
        mergedReplayEvent?.entries[0]?.data?.filter(datum => datum?.data?.memory) || [];

      if (mergedReplayEvent.entries[0]) {
        mergedReplayEvent.entries[0].data = mergedReplayEvent?.entries[0]?.data?.filter(
          datum => !datum?.data?.memory
        );
      }

      // Find LCP spans that have a valid replay node id, this will be used to
      const highlights = createHighlightEvents(mergedReplayEvent?.entries[0].data);

      // TODO(replays): ideally this would happen on SDK, but due
      // to how plugins work, we are unable to specify a timestamp for an event
      // (rrweb applies it), so it's possible actual LCP timestamp does not
      // match when the observer happens and we emit an rrweb event (will
      // look into this)
      const rrwebEventsWithHighlights = mergeAndSortEvents(rrwebEvents, highlights);

      setState({
        ...state,
        fetchError: undefined,
        fetching: false,
        event,
        mergedReplayEvent,
        replayEvents,
        rrwebEvents: rrwebEventsWithHighlights,
        breadcrumbEntry,
        memorySpans,
      });
    } catch (error) {
      Sentry.captureException(error);
      setState({
        ...INITIAL_STATE,
        fetchError: error,
        fetching: false,
      });
    }
  }

  useEffect(() => void loadEvents(), [orgId, eventSlug, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRetry = useCallback(() => {
    setRetry(true);
  }, []);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry,
    replay: ReplayReader.factory(state.event, state.rrwebEvents, state.replayEvents),

    breadcrumbEntry: state.breadcrumbEntry,
    event: state.event,
    replayEvents: state.replayEvents,
    rrwebEvents: state.rrwebEvents,
    mergedReplayEvent: state.mergedReplayEvent,
    memorySpans: state.memorySpans,
  };
}

export default useReplayEvent;
