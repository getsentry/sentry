import {useEffect, useRef, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import type {Client} from 'sentry/api';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {AvatarProject, Project} from 'sentry/types/project';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type ProjectPlaceholder = AvatarProject;

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
   * Indicates that Project results (from API) are paginated and there are more
   * projects that are not in the initial response
   */
  hasMore: null | boolean;
  /**
   * Reflects whether or not the initial fetch for the requested projects
   * was fulfilled. This accounts for both the store and specifically loaded
   * slugs.
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
   * This is an action provided to consumers for them to update the current
   * projects result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => Promise<void>;
  /**
   * When loading specific slugs, placeholder objects will be returned
   */
  placeholders: ProjectPlaceholder[];
  /**
   * The loaded projects list
   */
  projects: Project[];
  /**
   * Allows consumers to force refetch project data.
   */
  reloadProjects: () => Promise<void>;
} & Pick<State, 'fetching' | 'hasMore' | 'fetchError' | 'initiallyLoaded'>;

type Options = {
  /**
   * Number of projects to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * Specify an orgId, overriding the organization in the current context
   */
  orgId?: string;
  /**
   * List of slugs to look for summaries for, this can be from `props.projects`,
   * otherwise fetch from API
   */
  slugs?: string[];
};

type FetchProjectsOptions = {
  cursor?: State['nextCursor'];
  lastSearch?: State['lastSearch'];
  limit?: Options['limit'];
  search?: State['lastSearch'];
  slugs?: string[];
};

/**
 * Helper function to actually load projects
 */
async function fetchProjects(
  api: Client,
  orgId: string,
  {slugs, search, limit, lastSearch, cursor}: FetchProjectsOptions = {}
) {
  const query: {
    collapse: string[];
    all_projects?: number;
    cursor?: typeof cursor;
    per_page?: number;
    query?: string;
  } = {
    // Never return latestDeploys project property from api
    collapse: ['latestDeploys', 'unusedFeatures'],
  };

  if (slugs !== undefined && slugs.length > 0) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ?? ''}${search}`.trim();
  }

  const prevSearchMatches = (!lastSearch && !search) || lastSearch === search;

  if (prevSearchMatches && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  let hasMore: null | boolean = false;
  let nextCursor: null | string = null;
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/projects/`, {
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
 * Provides projects from the ProjectsStore
 *
 * This hook also provides a way to select specific project slugs, and search
 * (type-ahead) for more projects that may not be in the project store.
 *
 * NOTE: Currently ALL projects are always loaded, but this hook is designed
 * for future-compat in a world where we do _not_ load all projects.
 */
function useProjects({limit, slugs, orgId: propOrgId}: Options = {}) {
  const api = useApi();

  const organization = useOrganization({allowNull: true});
  const store = useLegacyStore(ProjectsStore);

  const orgId = propOrgId ?? organization?.slug ?? organization?.slug;

  const storeSlugs = new Set(store.projects.map(t => t.slug));
  const slugsToLoad = slugs?.filter(slug => !storeSlugs.has(slug)) ?? [];
  const shouldLoadSlugs = slugsToLoad.length > 0;

  const [state, setState] = useState<State>({
    initiallyLoaded: !store.loading && !shouldLoadSlugs,
    fetching: shouldLoadSlugs,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null,
  });

  const slugsRef = useRef<Set<string> | null>(null);

  // Only initialize slugsRef.current once and modify it when we receive new
  // slugs determined through set equality
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

  async function loadProjectsBySlug() {
    if (orgId === undefined) {
      // eslint-disable-next-line no-console
      console.error('Cannot use useProjects({slugs}) without an organization in context');
      return;
    }

    setState(prev => ({...prev, fetching: true}));
    try {
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        slugs: slugsToLoad,
        limit,
      });

      // Note the order of uniqBy: we prioritize project data recently fetched over previously cached data
      const fetchedProjects = uniqBy([...results, ...store.projects], ({slug}) => slug);
      ProjectsStore.loadInitialData(fetchedProjects);

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
        initiallyLoaded: !store.loading,
        fetchError: err,
      }));
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
      console.error('Cannot use useProjects.onSearch without an organization in context');
      return;
    }

    setState(prev => ({...prev, fetching: true}));

    try {
      api.clear();
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor,
      });

      const fetchedProjects = uniqBy([...store.projects, ...results], ({slug}) => slug);

      // Only update the store if we have more items
      if (fetchedProjects.length > store.projects.length) {
        ProjectsStore.loadInitialData(fetchedProjects);
      }

      setState(prev => ({
        ...prev,
        hasMore,
        fetching: false,
        lastSearch: search,
        nextCursor,
      }));
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState(prev => ({...prev, fetching: false, fetchError: err}));
    }
  }

  useEffect(() => {
    // Load specified team slugs
    if (shouldLoadSlugs) {
      loadProjectsBySlug();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugsRef.current]);

  // Update initiallyLoaded when we finish loading within the projectStore
  useEffect(() => {
    const storeLoaded = !store.loading;

    if (state.initiallyLoaded === storeLoaded) {
      return;
    }

    if (shouldLoadSlugs) {
      return;
    }

    setState(prev => ({...prev, initiallyLoaded: storeLoaded}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.loading]);

  const {initiallyLoaded, fetching, fetchError, hasMore} = state;

  const filteredProjects = slugs
    ? store.projects.filter(t => slugs.includes(t.slug))
    : store.projects;

  const placeholders = slugsToLoad.map(slug => ({slug}));

  const result: Result = {
    projects: filteredProjects,
    placeholders,
    fetching: fetching || store.loading,
    initiallyLoaded,
    fetchError,
    hasMore,
    onSearch: handleSearch,
    reloadProjects: loadProjectsBySlug,
  };

  return result;
}

export default useProjects;
