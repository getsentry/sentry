import {useEffect, useState} from 'react';
import type RRWebPlayer from 'rrweb-player';

import {IssueAttachment} from 'sentry/types';
import {Event} from 'sentry/types/event';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {Replay} from 'sentry/views/replays//types';

export type RRWebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];

type State = {
  // initiallyLoaded: boolean;
  /**
   * The root replay event
   */
  event: Event | null;
  fetchError: null | RequestError;

  fetching: boolean;
  replayEvents: Event[];
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

// const IS_RRWEB_ATTACHMENT_FILENAME = /rrweb-[0-9]{13}.json/;

function useReplayEvent({eventSlug, location, orgId}: Options): Result {
  // console.log('hook entered');
  const api = useApi();

  const [projectId, eventId] = eventSlug.split(':');

  const [state, setState] = useState<State>({
    // initiallyLoaded,
    fetchError: null,
    fetching: false,
    event: null,

    replayEvents: [],
    rrwebEvents: undefined,
  });

  // const initiallyLoaded = state.event;

  // function createAttachmentUrl(attachment: IssueAttachment) {
  //   return IS_RRWEB_ATTACHMENT_FILENAME.test(attachment.name)
  //     ? `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`
  //     : null;
  // }

  const replayId = eventSlug.split(':')[1];

  function fetchEvent() {
    return api.requestPromise(`/organizations/${orgId}/events/${eventSlug}/`);
  }

  function fetchAttachmentList() {
    return api.requestPromise(
      `/projects/${orgId}/${projectId}/events/${eventId}/attachments/`
    );
  }

  function fetchReplayEventList() {
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
    replayEventsView.additionalConditions.addFilterValues('rootReplayId', [replayId]);
    const replayEventsQuery = replayEventsView.getEventsAPIPayload(location);

    return api.requestPromise(`/organizations/${orgId}/eventsv2/`, {
      query: replayEventsQuery,
    });
  }

  function fetchAttachments(attachments: IssueAttachment[]) {
    return attachments.map(attachment =>
      api
        .requestPromise(
          `/api/0/projects/${orgId}/${projectId}/events/${eventId}/attachments/${attachment.id}/?download`
        )
        .then(resp => JSON.parse(resp))
        .then(json => json.events)
    );
  }

  function fetchReplayEvents(replayEventIds: Replay[]) {
    return replayEventIds.map(event =>
      api.requestPromise(`/organizations/${orgId}/events/${generateEventSlug(event)}/`)
    );
  }

  async function loadEvents() {
    // console.log('setting event = null');
    setState({
      fetchError: null,
      fetching: true,

      event: null,
      replayEvents: [],
      rrwebEvents: undefined,
    });
    const [event, attachmentList, replayEventList] = await Promise.all([
      fetchEvent(),
      fetchAttachmentList(),
      fetchReplayEventList(),
    ]);

    // console.log({event, attachmentList, replayEventList});
    setState({
      ...state,
      event,
    });

    const [attachments, replayEvents] = await Promise.all([
      Promise.all(fetchAttachments(attachmentList)),
      Promise.all(fetchReplayEvents(replayEventList.data)),
    ]);

    // const attachments = await Promise.all(
    //   attachmentList.map(fetch)
    // );
    // const replayEvents = await Promise.all(

    // );
    // console.log({attachments});
    // const rrwebEvents = attachments.

    setState({
      ...state,
      fetchError: null,
      fetching: false,
      event,
      replayEvents,
      rrwebEvents: attachments.flat(),
    });

    // await api.requestPromise(`/projects/${orgId}/${projectId}/events/${event.id}/attachments/`);

    // // get attachment list
    // [
    //   'attachmentList',
    //   `/projects/${orgId}/${projectId}/events/${event.id}/attachments/`,

    //   // This was changed from `rrweb.json`, so that we can instead
    //   // support incremental rrweb events as attachments. This is to avoid
    //   // having clients uploading a single, large sized replay.
    //   //
    //   // Note: This will include all attachments that contain `rrweb`
    //   // anywhere its name. We need to maintain compatibility with existing
    //   // rrweb plugin users (single replay), but also support incremental
    //   // replays as well. I can't think of a reason why someone would have
    //   // a non-rrweb replay containing the string `rrweb`, but people have
    //   // surprised me before.
    //   {query: {query: 'rrweb'}},
    // ],
    // //
    // const urls = attachments.map(createAttachmentUrl).filter(Boolean);

    // const data: RRWebEvents[] = await Promise.all(
    //   urls.map(async url => {
    //     const resp = await fetch(url);
    //     const json = await resp.json();

    //     return json.events;
    //   })
    // );

    // setEvents(data.flat());
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
