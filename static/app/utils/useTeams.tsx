import {useCallback, useEffect, useMemo, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import {fetchUserTeams} from 'sentry/actionCreators/teams';
import type {Client} from 'sentry/api';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types/organization';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type RequestError from 'sentry/utils/requestError/requestError';
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
   *
   * A null value indicates that we don't know if there are more values.
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
   * Number of teams to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * When true, fetches user's teams if necessary and only provides user's
   * teams (isMember = true).
   *
   * @deprecated use `useUserTeams()`
   */
  provideUserTeams?: boolean;
  /**
   * When provided, fetches specified teams by slug if necessary and only provides those teams.
   *
   * @deprecated use `useTeamsById({slugs: []})`
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
 *
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
    hasMore = paginationObject?.next?.results ?? null;
    nextCursor = paginationObject?.next?.cursor ?? null;
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
 * @deprecated use the alternatives to this hook (except for search and pagination)
 * new alternatives:
 * - useTeamsById({ids: []}) - get teams by id
 * - useTeamsById({slugs: []}) - get teams by slug
 * - useTeamsById() - just reading from the teams store
 * - useUserTeams() - same as `provideUserTeams: true`
 *
 */
export function useTeams({limit, slugs, provideUserTeams}: Options = {}) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(TeamStore);

  const orgId = organization?.slug;

  const storeSlugs = useMemo(() => new Set(store.teams.map(t => t.slug)), [store.teams]);

  const slugsToLoad = useMemo(
    () => slugs?.filter(slug => !storeSlugs.has(slug)) ?? [],
    [slugs, storeSlugs]
  );
  const shouldLoadByQuery = slugsToLoad.length > 0;
  const shouldLoadUserTeams = provideUserTeams && !store.loadedUserTeams;

  // If we don't need to make a request either for slugs or user teams, set
  // initiallyLoaded to true
  const initiallyLoaded = !shouldLoadUserTeams && !shouldLoadByQuery;

  const [state, setState] = useState<State>({
    initiallyLoaded,
    fetching: false,
    hasMore: store.hasMore,
    lastSearch: null,
    nextCursor: store.cursor,
    fetchError: null,
  });

  const loadUserTeams = useCallback(
    async function () {
      if (orgId === undefined) {
        return;
      }

      setState(prev => ({...prev, fetching: true}));
      try {
        await fetchUserTeams(api, {orgId});

        setState(prev => ({...prev, fetching: false, initiallyLoaded: true}));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        setState(prev => ({
          ...prev,
          fetching: false,
          initiallyLoaded: true,
          fetchError: err,
        }));
      }
    },
    [api, orgId]
  );

  const loadTeamsByQuery = useCallback(
    async function () {
      if (orgId === undefined) {
        return;
      }

      setState(prev => ({...prev, fetching: true}));
      try {
        const {results, hasMore, nextCursor} = await fetchTeams(api, orgId, {
          slugs: slugsToLoad,
          limit,
        });

        // Unique by `id` to avoid duplicates due to renames and state store data
        const fetchedTeams = uniqBy<Team>([...results, ...store.teams], ({id}) => id);
        TeamStore.loadInitialData(fetchedTeams);

        setState(prev => ({
          ...prev,
          hasMore,
          fetching: false,
          initiallyLoaded: true,
          nextCursor,
        }));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        setState(prev => ({
          ...prev,
          fetching: false,
          initiallyLoaded: true,
          fetchError: err,
        }));
      }
    },
    [api, limit, orgId, slugsToLoad, store.teams]
  );

  const handleFetchAdditionalTeams = useCallback(
    async function (search?: string) {
      const lastSearch = state.lastSearch;
      // Use the store cursor if there is no search keyword provided
      const cursor = search ? state.nextCursor : store.cursor;

      if (orgId === undefined) {
        // eslint-disable-next-line no-console
        console.error(
          'Cannot fetch teams without an organization in context and in the Store'
        );
        return;
      }

      setState(prev => ({...prev, fetching: true}));

      try {
        api.clear();
        const {results, hasMore, nextCursor} = await fetchTeams(api, orgId, {
          search,
          limit,
          lastSearch,
          cursor,
        });

        const fetchedTeams = uniqBy<Team>([...store.teams, ...results], ({slug}) => slug);

        if (search) {
          // Only update the store if we have more items
          if (fetchedTeams.length > store.teams.length) {
            TeamStore.loadInitialData(fetchedTeams);
          }
        } else {
          // If we fetched a page of teams without a search query, add cursor data to the store
          TeamStore.loadInitialData(fetchedTeams, hasMore, nextCursor);
        }

        setState(prev => ({
          ...prev,
          hasMore: hasMore && store.hasMore,
          fetching: false,
          lastSearch: search ?? null,
          nextCursor,
        }));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        setState(prev => ({...prev, fetching: false, fetchError: err}));
      }
    },
    [
      api,
      limit,
      orgId,
      state.lastSearch,
      state.nextCursor,
      store.cursor,
      store.hasMore,
      store.teams,
    ]
  );

  const handleSearch = useCallback(
    function (search: string) {
      if (search !== '') {
        return handleFetchAdditionalTeams(search);
      }

      // Reset pagination state to match store if doing an empty search
      if (state.hasMore !== store.hasMore || state.nextCursor !== store.cursor) {
        setState(prev => ({
          ...prev,
          lastSearch: search,
          hasMore: store.hasMore,
          nextCursor: store.cursor,
        }));
      }

      return Promise.resolve();
    },
    [
      handleFetchAdditionalTeams,
      state.hasMore,
      state.nextCursor,
      store.cursor,
      store.hasMore,
    ]
  );

  // Load specified team slugs
  useEffect(() => {
    if (shouldLoadByQuery) {
      loadTeamsByQuery();
    }
  }, [shouldLoadByQuery, loadTeamsByQuery]);

  useEffect(() => {
    if (shouldLoadUserTeams) {
      loadUserTeams();
    }
  }, [shouldLoadUserTeams, loadUserTeams]);

  const isSuperuser = isActiveSuperuser();

  const filteredTeams = useMemo(() => {
    return slugs
      ? store.teams.filter(t => slugs.includes(t.slug))
      : provideUserTeams && !isSuperuser
        ? store.teams.filter(t => t.isMember)
        : store.teams;
  }, [store.teams, slugs, provideUserTeams, isSuperuser]);

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
