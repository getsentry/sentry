import {useEffect, useState} from 'react';
import {Location} from 'history';

import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type OptionalProperties = 'projects' | 'environment' | 'id' | 'name' | 'version';
interface Params {
  /**
   * The Discover query to perform. This is a function because we will require the consumer of the hook to memoize this function.
   */
  discoverQuery: Omit<NewQuery, OptionalProperties> &
    Partial<Pick<NewQuery, OptionalProperties>>;

  endpoint?: string;

  /**
   * Should we ignore the current URL parameter `cursor`?
   *
   * This is useful when we are making nested discover queries and the child queries have their own cursor (or do not need it at all).
   */
  ignoreCursor?: boolean;
}

interface State<T> {
  data: T[] | undefined;
  error: Error | undefined;
  isLoading: boolean;
  pageLinks: string | undefined;
}

const INITIAL_STATE: Readonly<State<any>> = {
  isLoading: true,
  error: undefined,
  data: undefined,
  pageLinks: undefined,
};

const FAKE_LOCATION = {
  query: {},
} as Location;

/**
 * Simple custom hook to perform a Discover query.
 *
 * Note this does *not* handle URL parameters like the render component `<DiscoverQuery>`.
 * It will need to be handled in a parent.
 */
export default function useDiscoverQuery<T = unknown>({
  endpoint,
  discoverQuery,
  ignoreCursor,
}: Params) {
  const [state, setState] = useState<State<T>>(INITIAL_STATE);
  const api = useApi();
  const organization = useOrganization();

  useEffect(() => {
    async function runQuery() {
      const url = endpoint || `/organizations/${organization.slug}/eventsv2/`;
      const eventView = EventView.fromNewQueryWithLocation(
        {
          environment: [],
          projects: [],
          id: '',
          name: '',
          version: 2,
          ...discoverQuery,
        },
        FAKE_LOCATION
      );
      const query = eventView.getEventsAPIPayload(FAKE_LOCATION);

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
  }, [endpoint, discoverQuery, organization.slug, ignoreCursor]);

  return state;
}
