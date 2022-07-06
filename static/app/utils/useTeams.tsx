import {useEffect, useMemo, useRef, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import {fetchUserTeams} from 'sentry/actionCreators/teams';
import TeamActions from 'sentry/actions/teamActions';
import {Client} from 'sentry/api';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Team} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type State = {
  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;
  /**
   * This is state for when fetching data from API
   */
  fetching: boolean;
  /**
   * Indicates that Team results (from API) are paginated and there are more
   * Teams that are not in the initial response.
   */
  hasMore: null | boolean;
  /**
   * Reflects whether or not the initial fetch for the requested teams was
   * fulfilled
   */
  initiallyLoaded: boolean;
  /**
   * The last query we searched. Used to validate the cursor
   */
  lastSearch: null | string;
  /**
   * Pagination
   */
  nextCursor?: null | string;
};

type Result = {
  /**
   * This is an action provided to consumers for them to request more teams
   * to be loaded. Additional teams will be fetched and loaded into the store.
   */
  loadMore: (searchTerm?: string) => Promise<void>;
  /**
   * This is an action provided to consumers for them to update the current
   * teams result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => Promise<void>;
  /**
   * The loaded teams list
   */
  teams: Team[];
} & Pick<State, 'fetching' | 'hasMore' | 'fetchError' | 'initiallyLoaded'>;

type Options = {
  /**
   * When provided, fetches specified teams by id if necessary and only provides those teams.
   */
  ids?: string[];
  /**
   * Number of teams to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * When true, fetches user's teams if necessary and only provides user's
   * teams (isMember = true).
   */
  provideUserTeams?: boolean;
  /**
   * When provided, fetches specified teams by slug if necessary and only provides those teams.
   */
  slugs?: string[];
};

type FetchTeamOptions = {
  cursor?: State['nextCursor'];
  ids?: string[];
  lastSearch?: State['lastSearch'];
  limit?: Options['limit'];
  search?: State['lastSearch'];
  slugs?: string[];
};

/**
 * Helper function to actually load teams
 */
async function fetchTeams(
  api: Client,
  orgId: string,
  {slugs, ids, search, limit, lastSearch, cursor}: FetchTeamOptions = {}
) {
  const query: {
    cursor?: typeof cursor;
    per_page?: number;
    query?: string;
  } = {};

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (ids !== undefined && ids.length > 0) {
    query.query = ids.map(id => `id:${id}`).join(' ');
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
    hasMore = paginationObject?.next?.results;
    nextCursor = paginationObject?.next?.cursor;
  }

  return {results: data, hasMore, nextCursor};
}

// TODO: Paging for items which have already exist in the store is not
// correctly implemented.

/**
 * Provides teams from the TeamStore
 *
 * This hook also provides a way to select specific slugs to ensure they are
 * loaded, as well as search (type-ahead) for more slugs that may not be in the
 * TeamsStore.
 *
 * NOTE: It is NOT guaranteed that all teams for an organization will be
 * loaded, so you should use this hook with the intention of providing specific
 * slugs, or loading more through search.
 *
 */
function useTeams({limit, slugs, ids, provideUserTeams}: Options = {}) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(TeamStore);

  const orgId = organization?.slug;

  const storeSlugs = new Set(store.teams.map(t => t.slug));
  const slugsToLoad = slugs?.filter(slug => !storeSlugs.has(slug)) ?? [];
  const storeIds = new Set(store.teams.map(t => t.id));
  const idsToLoad = ids?.filter(id => !storeIds.has(id)) ?? [];
  const shouldLoadSlugs = slugsToLoad.length > 0;
  const shouldLoadIds = idsToLoad.length > 0;
  const shouldLoadTeams = provideUserTeams && !store.loadedUserTeams;

  // If we don't need to make a request either for slugs or user teams, set
  // initiallyLoaded to true
  const initiallyLoaded = !shouldLoadSlugs && !shouldLoadTeams && !shouldLoadIds;

  const [state, setState] = useState<State>({
    initiallyLoaded,
    fetching: false,
    hasMore: store.hasMore,
    lastSearch: null,
    nextCursor: store.cursor,
    fetchError: null,
  });

  const slugOrIdRef = useRef<Set<string> | null>(null);

  // Only initialize slugOrIdRef.current once and modify it when we receive new
  // slugs or ids determined through set equality
  if (slugs !== undefined || ids !== undefined) {
    const slugsOrIds = (slugs || ids) ?? [];
    if (slugOrIdRef.current === null) {
      slugOrIdRef.current = new Set(slugsOrIds);
    }

    if (
      slugsOrIds.length !== slugOrIdRef.current.size ||
      slugsOrIds.some(slugOrId => !slugOrIdRef.current?.has(slugOrId))
    ) {
      slugOrIdRef.current = new Set(slugsOrIds);
    }
  }

  async function loadUserTeams() {
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

  async function loadTeamsBySlugOrId() {
    if (orgId === undefined) {
      return;
    }

    setState({...state, fetching: true});
    try {
      const {results, hasMore, nextCursor} = await fetchTeams(api, orgId, {
        slugs: slugsToLoad,
        ids: idsToLoad,
        limit,
      });

      // Unique by `id` to avoid duplicates due to renames and state store data
      const fetchedTeams = uniqBy([...results, ...store.teams], ({id}) => id);
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

  function handleSearch(search: string) {
    if (search !== '') {
      return handleFetchAdditionalTeams(search);
    }

    // Reset pagination state to match store if doing an empty search
    if (state.hasMore !== store.hasMore || state.nextCursor !== store.cursor) {
      setState({
        ...state,
        lastSearch: search,
        hasMore: store.hasMore,
        nextCursor: store.cursor,
      });
    }

    return Promise.resolve();
  }

  async function handleFetchAdditionalTeams(search?: string) {
    const {lastSearch} = state;
    // Use the store cursor if there is no search keyword provided
    const cursor = search ? state.nextCursor : store.cursor;

    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot fetch teams without an organization in context');
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

      if (search) {
        // Only update the store if we have more items
        if (fetchedTeams.length > store.teams.length) {
          TeamActions.loadTeams(fetchedTeams);
        }
      } else {
        // If we fetched a page of teams without a search query, add cursor data to the store
        TeamActions.loadTeams(fetchedTeams, hasMore, nextCursor);
      }

      setState({
        ...state,
        hasMore: hasMore && store.hasMore,
        fetching: false,
        lastSearch: search ?? null,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, fetching: false, fetchError: err});
    }
  }

  useEffect(() => {
    // Load specified team slugs
    if (shouldLoadSlugs || shouldLoadIds) {
      loadTeamsBySlugOrId();
      return;
    }

    // Load user teams
    if (shouldLoadTeams) {
      loadUserTeams();
    }
  }, [slugOrIdRef.current, provideUserTeams]);

  const isSuperuser = isActiveSuperuser();

  const filteredTeams = useMemo(() => {
    return slugs
      ? store.teams.filter(t => slugs.includes(t.slug))
      : ids
      ? store.teams.filter(t => ids.includes(t.id))
      : provideUserTeams && !isSuperuser
      ? store.teams.filter(t => t.isMember)
      : store.teams;
  }, [store.teams, ids, slugs, provideUserTeams, isSuperuser]);

  const result: Result = {
    teams: filteredTeams,
    fetching: state.fetching || store.loading,
    initiallyLoaded: state.initiallyLoaded,
    fetchError: state.fetchError,
    hasMore: state.hasMore ?? store.hasMore,
    onSearch: handleSearch,
    loadMore: handleFetchAdditionalTeams,
  };

  return result;
}

export default useTeams;
