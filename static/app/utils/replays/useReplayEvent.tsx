import {useCallback, useEffect, useState} from 'react';
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
   * When provided, fetches specified replay event by slug
   */
  eventSlug: string;

  /**
   *
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

function useReplayEvent({eventSlug, orgId}: Options): Result {
  const [projectId, eventId] = eventSlug.split(':');

  const api = useApi();
  const [retry, setRetry] = useState(true);
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

  const loadEvents = useCallback(
    async function () {
      setState(INITIAL_STATE);

      try {
        const [event, rrwebEvents, replayEvents] = await Promise.all([
          fetchEvent(),
          fetchRRWebEvents(),
          fetchReplayEvents(),
        ]);

        // const breadcrumbEntry = mergeBreadcrumbsEntries(replayEvents || [], event);
        // const mergedReplayEvent = mergeEventsWithSpans(replayEvents || []);
        // const memorySpans =
        //   mergedReplayEvent?.entries[0]?.data?.filter(datum => datum?.data?.memory) || [];

        // if (mergedReplayEvent.entries[0]) {
        //   mergedReplayEvent.entries[0].data = mergedReplayEvent?.entries[0]?.data?.filter(
        //     datum => !datum?.data?.memory
        //   );
        // }

        // // Find LCP spans that have a valid replay node id, this will be used to
        // const highlights = createHighlightEvents(mergedReplayEvent?.entries[0].data);

        // // TODO(replays): ideally this would happen on SDK, but due
        // // to how plugins work, we are unable to specify a timestamp for an event
        // // (rrweb applies it), so it's possible actual LCP timestamp does not
        // // match when the observer happens and we emit an rrweb event (will
        // // look into this)
        // const rrwebEventsWithHighlights = mergeAndSortEvents(rrwebEvents, highlights);

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
    },
    [fetchEvent, fetchRRWebEvents, fetchReplayEvents]
  );

  useEffect(() => {
    if (retry) {
      setRetry(false);
      loadEvents();
    }
  }, [retry, loadEvents]);

  const onRetry = useCallback(() => {
    setRetry(true);
  }, []);

  return {
    fetchError: state.fetchError,
    fetching: state.fetching,
    onRetry,
    replay: ReplayReader.factory(state.event, state.rrwebEvents, state.replayEvents),

    // breadcrumbEntry: state.breadcrumbEntry,
    // event: state.event,
    // replayEvents: state.replayEvents,
    // rrwebEvents: state.rrwebEvents,
    // mergedReplayEvent: state.mergedReplayEvent,
    // memorySpans: state.memorySpans,
  };
}

export default useReplayEvent;
