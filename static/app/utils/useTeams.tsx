import {useEffect, useRef, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import {fetchUserTeams} from 'app/actionCreators/teams';
import TeamActions from 'app/actions/teamActions';
import {Client} from 'app/api';
import OrganizationStore from 'app/stores/organizationStore';
import TeamStore from 'app/stores/teamStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import {Team} from 'app/types';
import {isActiveSuperuser} from 'app/utils/isActiveSuperuser';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import RequestError from 'app/utils/requestError/requestError';
import useApi from 'app/utils/useApi';

type State = {
  /**
   * This is state for when fetching data from API
   */
  fetching: boolean;
  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;
  /**
   * Reflects whether or not the initial fetch for the requested teams was fulfilled
   */
  initiallyLoaded: boolean;
  /**
   * Indicates that Team results (from API) are paginated and there are more
   * Teams that are not in the initial response.
   */
  hasMore: null | boolean;
  /**
   * The last query we searched. Used to validate the cursor
   */
  lastSearch: null | string;
  /**
   * Pagination
   */
  nextCursor?: null | string;
};

export type Result = {
  /**
   * The loaded teams list
   */
  teams: Team[];
  /**
   * This is an action provided to consumers for them to update the current
   * teams result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => Promise<void>;
} & Pick<State, 'fetching' | 'hasMore' | 'fetchError' | 'initiallyLoaded'>;

type Options = {
  /**
   * Number of teams to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * When provided, fetches specified teams by slug if necessary and only provides those teams.
   */
  slugs?: string[];
  /**
   * When true, fetches user's teams if necessary and only provides user's teams (isMember = true).
   */
  provideUserTeams?: boolean;
};

type FetchTeamOptions = Pick<Options, 'limit'> & {
  slugs?: string[];
  cursor?: State['nextCursor'];
  search?: State['lastSearch'];
  lastSearch?: State['lastSearch'];
};

/**
 * Helper function to actually load teams
 */
async function fetchTeams(
  api: Client,
  orgId: string,
  {slugs, search, limit, lastSearch, cursor}: FetchTeamOptions = {}
) {
  const query: {
    query?: string;
    cursor?: typeof cursor;
    per_page?: number;
  } = {};

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ?? ''} ${search}`.trim();
  }

  const isSameSearch = lastSearch === search || (!lastSearch && !search);

  if (isSameSearch && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  let hasMore: null | boolean = false;
  let nextCursor: null | string = null;
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/teams/`, {
    includeAllArgs: true,
    query,
  });

  const pageLinks = resp?.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore = paginationObject?.next?.results || paginationObject?.previous?.results;
    nextCursor = paginationObject?.next?.cursor;
  }

  return {results: data, hasMore, nextCursor};
}

function useTeams({limit, slugs, provideUserTeams}: Options = {}) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(TeamStore);

  const storeSlugs = new Set(store.teams.map(t => t.slug));
  const slugsToLoad = slugs?.filter(slug => !storeSlugs.has(slug)) ?? [];
  const shouldLoadSlugs = slugsToLoad.length > 0;
  const shouldLoadTeams = provideUserTeams && !store.loadedUserTeams;

  // If we don't need to make a request either for slugs or user teams, set initiallyLoaded to true
  const initiallyLoaded = !shouldLoadSlugs && !shouldLoadTeams;
  const [state, setState] = useState<State>({
    initiallyLoaded,
    fetching: false,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null,
  });

  const slugsRef = useRef<Set<string> | null>(null);
  // Only initialize slugsRef.current once and modify it when we receive new slugs determined through set equality
  if (slugs !== undefined) {
    if (slugsRef.current === null) {
      slugsRef.current = new Set(slugs);
    }

    if (
      slugs.length !== slugsRef.current.size ||
      slugs.some(slug => !slugsRef.current?.has(slug))
    ) {
      slugsRef.current = new Set(slugs);
    }
  }

  async function loadUserTeams() {
    const orgId = organization?.slug;
    if (orgId === undefined) {
      return;
    }

    setState({...state, fetching: true});
    try {
      await fetchUserTeams(api, {orgId});

      setState({...state, fetching: false, initiallyLoaded: true});
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, fetching: false, initiallyLoaded: true, fetchError: err});
    }
  }

  async function loadTeamsBySlug() {
    const orgId = organization?.slug;
    if (orgId === undefined) {
      return;
    }

    setState({...state, fetching: true});
    try {
      const {results, hasMore, nextCursor} = await fetchTeams(api, orgId, {
        slugs: slugsToLoad,
        limit,
      });

      const fetchedTeams = uniqBy([...store.teams, ...results], ({slug}) => slug);
      TeamActions.loadTeams(fetchedTeams);

      setState({
        ...state,
        hasMore,
        fetching: false,
        initiallyLoaded: true,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, fetching: false, initiallyLoaded: true, fetchError: err});
    }
  }

  async function handleSearch(search: string) {
    const {lastSearch} = state;
    const cursor = state.nextCursor;

    if (search === '') {
      return;
    }

    const orgId = organization?.slug;
    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useTeam.onSearch without an orgId passed to useTeam');
      return;
    }

    setState({...state, fetching: true});

    try {
      api.clear();
      const {results, hasMore, nextCursor} = await fetchTeams(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor,
      });

      const fetchedTeams = uniqBy([...store.teams, ...results], ({slug}) => slug);

      // Only update the store if we have more items
      if (fetchedTeams.length > store.teams.length) {
        TeamActions.loadTeams(fetchedTeams);
      }

      setState({
        ...state,
        hasMore,
        fetching: false,
        lastSearch: search,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, fetching: false, fetchError: err});
    }
  }

  useEffect(() => {
    // Load specified team slugs
    if (shouldLoadSlugs) {
      loadTeamsBySlug();
      return;
    }

    // Load user teams
    if (shouldLoadTeams) {
      loadUserTeams();
    }
  }, [slugsRef.current, provideUserTeams]);

  const isSuperuser = isActiveSuperuser();
  let filteredTeams = store.teams;
  if (slugs) {
    filteredTeams = filteredTeams.filter(t => slugs.includes(t.slug));
  } else if (provideUserTeams && !isSuperuser) {
    filteredTeams = filteredTeams.filter(t => t.isMember);
  }

  const result: Result = {
    teams: filteredTeams,
    fetching: state.fetching || store.loading,
    initiallyLoaded: state.initiallyLoaded,
    fetchError: state.fetchError,
    hasMore: state.hasMore,
    onSearch: handleSearch,
  };

  return result;
}

export default useTeams;
