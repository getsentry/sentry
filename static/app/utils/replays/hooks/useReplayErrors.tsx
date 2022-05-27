import {useCallback, useEffect, useState} from 'react';

import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ReplayError} from 'sentry/views/replays/types';

interface Params {
  replayId: string;
}

interface State {
  data: ReplayError[] | undefined;
  error: Error | undefined;
  isLoading: boolean;
  pageLinks: string | undefined;
}

const INITIAL_STATE: State = {
  isLoading: true,
  error: undefined,
  data: undefined,
  pageLinks: undefined,
} as const;

/**
 * Fetches a list of errors that occurred in a replay
 */
export default function useReplayErrors({replayId}: Params) {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const getEventView = useCallback(
    () => {
      const eventQueryParams: NewQuery = {
        query: `replayId:${replayId} AND event.type:error`,
        fields: ['event.id', 'error.value', 'timestamp', 'error.type', 'issue.id'],

        id: '',
        name: '',
        version: 2,

        // environment and project shouldn't matter because having a replayId
        // assumes we have already filtered down to proper env/project
        environment: [],
        projects: [],
      };
      return EventView.fromNewQueryWithLocation(eventQueryParams, location);
    },

    // Ignore `location` here as only replayId should be a dependency. `location`
    // is only used to satisfy `fromNewQueryWithLocation`. This can change if
    // for whatever reason we decide to add e.g. page filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replayId]
  );

  useEffect(() => {
    async function runQuery() {
      const url = `/organizations/${organization.slug}/eventsv2/`;
      const eventView = getEventView();
      const query = eventView.getEventsAPIPayload(location);

      setState(prevState => ({...prevState, isLoading: true, error: undefined}));
      api.clear();

      try {
        const [data, , resp] = await api.requestPromise(url, {
          includeAllArgs: true,
          query,
        });
        setState(prevState => ({
          ...prevState,
          isLoading: false,
          error: undefined,
          pageLinks: resp?.getResponseHeader('Link') ?? prevState.pageLinks,
          data: data.data,
        }));
      } catch (error) {
        setState(prevState => ({
          ...prevState,
          isLoading: false,
          error,
          data: undefined,
        }));
      }
    }

    runQuery();

    // location is ignored in deps array, see getEventView comments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, getEventView, organization.slug]);

  return state;
}
