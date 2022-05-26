import {useCallback, useEffect, useState} from 'react';

import {Client} from 'sentry/api';
import {Event} from 'sentry/types/event';
import useApi from 'sentry/utils/useApi';

type Options = {
  /**
   * The projectSlug and eventId concatenated together
   */
  eventSlug: string;

  /**
   * The organization slug
   */
  orgId: string;

  /**
   * Provide an api client to use for this request
   */
  api?: Client;
};

type State<EventType extends Event> = {
  data: EventType | undefined;
  error: any;
  fetching: boolean;
};

const INITIAL_STATE = Object.freeze({
  data: undefined,
  error: undefined,
  fetching: false,
});

function fetchEvent<EventType extends Event>(
  api: Client,
  orgId: string,
  eventSlug: string
) {
  return api.requestPromise(
    `/organizations/${orgId}/events/${eventSlug}/`
  ) as Promise<EventType>;
}

function useEvent<EventType extends Event>({
  api: providedApi,
  orgId,
  eventSlug,
}: Options): State<EventType> {
  const api = useApi({api: providedApi});
  const [state, setState] = useState<State<EventType>>(INITIAL_STATE);

  const load = useCallback(async () => {
    try {
      setState({
        data: undefined,
        error: undefined,
        fetching: true,
      });
      const event = await fetchEvent<EventType>(api, orgId, eventSlug);
      setState({
        data: event,
        error: undefined,
        fetching: false,
      });
    } catch (error) {
      setState({
        data: undefined,
        error,
        fetching: false,
      });
    }
  }, [api, orgId, eventSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}

export default useEvent;
