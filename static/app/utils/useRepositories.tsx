import {useEffect, useState} from 'react';

import RepositoryActions from 'app/actions/repositoryActions';
import {Client} from 'app/api';
import OrganizationStore from 'app/stores/organizationStore';
import RepositoryStore from 'app/stores/repositoryStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import {Repository} from 'app/types';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import RequestError from 'app/utils/requestError/requestError';
import useApi from 'app/utils/useApi';

type State = {
  /**
   * This is state for when fetching data from API
   */
  loading: boolean;
  /**
   * The error that occurred if fetching failed
   */
  error: null | RequestError;
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
   * The loaded repositories list
   */
  repositories: Repository[];
  /**
   * This is an action provided to consumers for them to update the current
   * result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => Promise<void>;
  nextPage: () => Promise<void>;
} & State;

type Options = {
  /**
   * Number of repositories to return
   */
  limit?: number;
};

type FetchRepositoryOptions = {
  limit?: Options['limit'];
  cursor?: State['nextCursor'];
  search?: State['lastSearch'];
  lastSearch?: State['lastSearch'];
};

/**
 * Helper function to actually load repositories
 */
async function fetchRepositories(
  api: Client,
  orgId: string,
  {search, limit, lastSearch, cursor}: FetchRepositoryOptions = {}
) {
  const query: {
    query?: string;
    cursor?: typeof cursor;
    per_page?: number;
  } = {};

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
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/repos/`, {
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

/**
 * Provides repositories from the RepositoryStore
 */
function useRepositories({limit}: Options = {}) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(RepositoryStore);

  const orgId = organization?.slug;

  if (store.orgSlug && store.orgSlug !== orgId) {
    RepositoryActions.resetRepositories();
  }

  const [state, setState] = useState<State>({
    loading: false,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    error: null,
  });

  async function loadRepositories(cursor: string | null = null) {
    if (orgId === undefined) {
      return;
    }

    setState({...state, loading: true});
    try {
      const {results, hasMore, nextCursor} = await fetchRepositories(api, orgId, {
        limit,
        cursor,
      });
      RepositoryActions.loadRepositoriesSuccess(results);

      setState({
        ...state,
        hasMore,
        loading: false,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      setState({...state, loading: false, error: err});
    }
  }

  async function handleSearch(search: string) {
    const {lastSearch} = state;
    const cursor = state.nextCursor;

    if (search === '') {
      return;
    }

    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error(
        'Cannot use useRepositories.onSearch without an organization in context'
      );
      return;
    }

    setState({...state, loading: true});

    try {
      api.clear();
      const {results, hasMore, nextCursor} = await fetchRepositories(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor,
      });

      RepositoryActions.loadRepositoriesSuccess(results);

      setState({
        ...state,
        hasMore,
        loading: false,
        lastSearch: search,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({...state, loading: false, error: err});
    }
  }

  useEffect(() => {
    /** Multiple components may call useRepositories.
     * We want to prevent making multiple calls for the same org. */
    if (orgId !== store.orgSlug) {
      loadRepositories();
    }
  }, [orgId]);

  const result: Result = {
    repositories: store.repositories,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    nextCursor: state.nextCursor,
    lastSearch: state.lastSearch,
    onSearch: handleSearch,
    nextPage: state.hasMore
      ? () => loadRepositories(state.nextCursor)
      : () => new Promise(resolve => resolve()),
  };

  return result;
}

export default useRepositories;
