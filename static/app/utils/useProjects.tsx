import {useEffect, useRef, useState} from 'react';
import memoize from 'lodash/memoize';
import partition from 'lodash/partition';
import uniqBy from 'lodash/uniqBy';

import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import ProjectsStore from 'app/stores/projectsStore';
import {useLegacyStore} from 'app/stores/useLegacyStore';
import {AvatarProject, Project} from 'app/types';
import {defined} from 'app/utils';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import RequestError from 'app/utils/requestError/requestError';
import useApi from 'app/utils/useApi';

type ProjectPlaceholder = AvatarProject;

type State = {
  /**
   * Projects from API
   */
  fetchedProjects: Project[] | ProjectPlaceholder[];
  /**
   * Projects fetched from store
   */
  projectsFromStore: Project[];
  /**
   * Reflects whether or not the initial fetch for the requested projects
   * was fulfilled
   */
  initiallyLoaded: boolean;
  /**
   * This is state for when fetching data from API
   */
  fetching: boolean;
  /**
   * This is set when we fail to find some slugs from both store and API
   */
  isIncomplete: null | boolean;
  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;
  /**
   * Indicates that Project results (from API) are paginated and there are more
   * projects that are not in the initial response
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
   * We want to make sure that at the minimum, we return a list of objects with
   * only `slug` while we load actual project data
   */
  projects: Project[] | ProjectPlaceholder[];
  /**
   * Calls API and searches for project
   */
  onSearch: (searchTerm: string, {append: boolean}) => void;
} & Pick<
  State,
  'isIncomplete' | 'fetching' | 'hasMore' | 'initiallyLoaded' | 'fetchError'
>;

type Options = {
  /**
   * Organization slug
   */
  orgId: string;
  /**
   * List of slugs to look for summaries for, this can be from `props.projects`,
   * otherwise fetch from API
   */
  slugs?: string[];
  /**
   * Number of projects to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * Whether to fetch all the projects in the organization of which the user
   * has access to
   * */
  allProjects?: boolean;
  /**
   * If slugs is passed, forward placeholder objects with slugs while fetching
   */
  passthroughPlaceholderProject?: boolean;
};

/**
 * Memoized function that returns a `Map<project.slug, project>`
 */
const getProjectsMap = memoize(
  (projects: Project[]) =>
    new Map<string, Project>(projects.map(project => [project.slug, project]))
);

type FetchProjectsOptions = Pick<Options, 'limit' | 'allProjects'> & {
  slugs?: string[];
  cursor?: State['nextCursor'];
  search?: State['lastSearch'];
  lastSearch?: State['lastSearch'];
};

/**
 * Helper function to actually load projects
 */
async function fetchProjects(
  api: Client,
  orgId: string,
  {slugs, search, limit, lastSearch, cursor, allProjects}: FetchProjectsOptions = {}
) {
  const query: {
    collapse: string[];
    query?: string;
    cursor?: typeof cursor;
    per_page?: number;
    all_projects?: number;
  } = {
    // Never return latestDeploys project property from api
    collapse: ['latestDeploys'],
  };

  if (allProjects) {
    const {loading, projects} = ProjectsStore.getState();

    // If we're trying to fetch all projects and it's already been loaded into
    // the store avoid fetching again
    if (!loading) {
      return {results: projects, hasMore: false};
    }

    query.all_projects = 1;
  }

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

  // Populate the projects store if all projects were fetched
  if (allProjects) {
    ProjectActions.loadProjects(data);
  }

  return {results: data, hasMore, nextCursor};
}

/**
 * Hook to efficently load projects.
 */
function useProjects({
  orgId,
  slugs,
  limit,
  allProjects,
  passthroughPlaceholderProject = true,
}: Options) {
  const api = useApi();
  const storeProjects = useLegacyStore(ProjectsStore);

  const [state, setState] = useState<State>({
    fetchedProjects: [],
    projectsFromStore: [],
    initiallyLoaded: false,
    fetching: false,
    isIncomplete: null,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null,
  });

  // List of projects that need to be fetched via API
  const fetchQueue = useRef(new Set<string>());

  useEffect(
    () => {
      /**
       * If `props.slugs` is not provided, request from API a list of paginated project summaries
       * that are in `prop.orgId`.
       *
       * Provide render prop with results as well as `hasMore` to indicate there are more results.
       * Downstream consumers should use this to notify users so that they can e.g. narrow down
       * results using search
       */
      async function loadAllProjects() {
        setState({...state, fetching: true});

        try {
          const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
            limit,
            allProjects,
          });

          setState({
            ...state,
            fetchedProjects: results,
            hasMore,
            nextCursor,
          });
        } catch (err) {
          console.error(err); // eslint-disable-line no-console

          setState({...state, fetchedProjects: [], fetchError: err});
        }

        setState({...state, fetching: false, initiallyLoaded: true});
      }

      /**
       * This will fetch projects via API (using project slug) provided by the
       * fetchQueue
       */
      async function fetchSpecificProjects() {
        if (!fetchQueue.current.size) {
          return;
        }

        setState({...state, fetching: true});

        let results: Project[] = [];
        let fetchError = null;

        const querySlugs = Array.from(fetchQueue.current);

        try {
          const resp = await fetchProjects(api, orgId, {slugs: querySlugs});
          results = resp.results;
        } catch (err) {
          console.error(err); // eslint-disable-line no-console
          fetchError = err;
        }

        const projectsMap = getProjectsMap(results);

        // For each item in the fetch queue, lookup the project object and in the case
        // where something wrong has happened and we were unable to get project summary from
        // the server, just fill in with an object with only the slug
        const projectsOrPlaceholder: Project[] | ProjectPlaceholder[] = Array.from(
          fetchQueue.current
        )
          .map(slug =>
            projectsMap.has(slug)
              ? projectsMap.get(slug)
              : !!passthroughPlaceholderProject
              ? {slug}
              : null
          )
          .filter(defined);

        setState({
          ...state,
          fetchedProjects: projectsOrPlaceholder,
          isIncomplete: fetchQueue.current.size !== results.length,
          initiallyLoaded: true,
          fetching: false,
          fetchError,
        });

        fetchQueue.current.clear();
      }

      // When `props.slugs` is included, identifies what projects we already have
      // summaries for and what projects need to be fetched from API
      if (slugs !== undefined && slugs.length > 0) {
        const projectsMap = getProjectsMap(storeProjects);

        // Split slugs into projects that are in store and not in store
        // (so we can request projects not in store)
        const [inStore, notInStore] = partition(slugs, slug => projectsMap.has(slug));

        // Get the actual summaries of projects that are in store
        const projectsFromStore = inStore
          .map(slug => projectsMap.get(slug))
          .filter(defined);

        // Add to queue
        notInStore.forEach(slug => fetchQueue.current.add(slug));

        setState({
          ...state,
          projectsFromStore,
          // placeholders for projects we need to fetch
          fetchedProjects: notInStore.map(slug => ({slug})),
          // set initiallyLoaded if any projects were fetched from store
          initiallyLoaded: !!inStore.length,
        });

        if (notInStore.length > 0) {
          fetchSpecificProjects();
        }

        return;
      }

      loadAllProjects();
    },
    // XXX: storeProjects is excluded here so we don't re-fetch everythng as more
    // projects are loaded into the store.
    [orgId, slugs, limit, allProjects, passthroughPlaceholderProject]
  );

  /**
   * This is an action provided to consumers for them to update the current
   * projects result set using a simple search query. You can allow the new
   * results to either be appended or replace the existing results.
   *
   * @param search The search term to use
   * @param options Options object
   * @param options.append Results should be appended to existing list (otherwise, will replace)
   */
  async function handleSearch(search: string, {append}: {append?: boolean} = {}) {
    const {lastSearch} = state;
    const cursor = state.nextCursor;

    setState({...state, fetching: true});

    try {
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        search,
        limit,
        lastSearch,
        cursor,
      });

      const fetchedProjects = append
        ? uniqBy([...state.fetchedProjects, ...results], ({slug}) => slug) // Remove duplicates
        : results;

      setState({
        ...state,
        fetchedProjects,
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

  const result: Result = {
    initiallyLoaded: state.initiallyLoaded,
    isIncomplete: state.isIncomplete,
    fetchError: state.fetchError,
    fetching: state.fetching,
    hasMore: state.hasMore,
    onSearch: handleSearch,
    projects: state.initiallyLoaded
      ? [...state.fetchedProjects, ...state.projectsFromStore]
      : slugs?.map(slug => ({slug})) ?? [],
  };

  return result;
}

export default useProjects;
