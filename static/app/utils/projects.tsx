import {useCallback, useEffect, useRef, useState} from 'react';
import partition from 'lodash/partition';

import type {Client} from 'sentry/api';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {AvatarProject, Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import {getDaysSinceDate} from 'sentry/utils/getDaysSinceDate';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useProjects} from 'sentry/utils/useProjects';

type ProjectPlaceholder = AvatarProject;

type State = {
  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;

  /**
   * Projects from API
   */
  fetchedProjects: Project[] | ProjectPlaceholder[];

  /**
   * This is state for when fetching data from API
   */
  fetching: boolean;

  /**
   * Project results (from API) are paginated and there are more projects
   * that are not in the initial queryset
   */
  hasMore: null | boolean;

  /**
   * Reflects whether or not the initial fetch for the requested projects
   * was fulfilled
   */
  initiallyLoaded: boolean;

  /**
   * This is set when we fail to find some slugs from both store and API
   */
  isIncomplete: null | boolean;
  prevSearch: null | string;
  /**
   * Projects fetched from store
   */
  projectsFromStore: Project[];

  nextCursor?: null | string;
};

type RenderProps = {
  /**
   * Calls API and searches for project
   */
  onSearch: (searchTerm: string) => void;

  /**
   * We want to make sure that at the minimum, we return a list of objects with only `slug`
   * while we load actual project data
   */
  projects: Project[] | ProjectPlaceholder[];
} & Pick<
  State,
  'isIncomplete' | 'fetching' | 'hasMore' | 'initiallyLoaded' | 'fetchError'
>;
type RenderFunc = (props: RenderProps) => React.ReactNode;

type Props = {
  children: RenderFunc;
  /**
   * Organization slug
   */
  orgId: string;
  /**
   * Whether to fetch all the projects in the organization of which the user
   * has access to
   */
  allProjects?: boolean;
  /**
   * Number of projects to return when not using `props.slugs`
   */
  limit?: number;
  /**
   * List of project ids to look for summaries for, this can be from `props.projects`,
   * otherwise fetch from API
   */
  projectIds?: number[];
  /**
   * List of slugs to look for summaries for, this can be from `props.projects`,
   * otherwise fetch from API
   */
  slugs?: string[];
};

const INITIAL_STATE: State = {
  fetchedProjects: [],
  projectsFromStore: [],
  initiallyLoaded: false,
  fetching: false,
  isIncomplete: null,
  hasMore: null,
  prevSearch: null,
  nextCursor: null,
  fetchError: null,
};

/**
 * Returns a `Map<project.slug, project>`
 */
function getProjectsMap(projects: Project[]): Map<string, Project> {
  return new Map(projects.map(project => [project.slug, project]));
}

/**
 * Returns a `Map<project.id, project>`
 */
function getProjectsIdMap(projects: Project[]): Map<number, Project> {
  return new Map(projects.map(project => [parseInt(project.id, 10), project]));
}

/**
 * @deprecated consider using useProjects if possible.
 *
 * This is a utility component that should be used to fetch an organization's projects (summary).
 * It can either fetch explicit projects (e.g. via slug) or a paginated list of projects.
 * These will be passed down to the render prop (`children`).
 *
 * The legacy way of handling this is that `ProjectSummary[]` is expected to be included in an
 * `Organization` as well as being saved to `ProjectsStore`.
 */
export function Projects({
  children,
  orgId,
  allProjects,
  limit,
  projectIds,
  slugs,
}: Props) {
  const api = useApi();
  // List of projects that we already have summaries for (i.e. from store)
  const {projects} = useProjects();

  const [state, setFullState] = useState<State>(INITIAL_STATE);
  const setState = useCallback(
    (patch: Partial<State>) => setFullState(prev => ({...prev, ...patch})),
    []
  );

  /**
   * List of projects that need to be fetched via API
   */
  const fetchQueue = useRef(new Set<string>());

  /**
   * If `props.slugs` is not provided, request from API a list of paginated project summaries
   * that are in `prop.orgId`.
   *
   * Provide render prop with results as well as `hasMore` to indicate there are more results.
   * Downstream consumers should use this to notify users so that they can e.g. narrow down
   * results using search
   */
  const loadAllProjects = async () => {
    setState({fetching: true});

    try {
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        limit,
        allProjects,
      });

      setState({
        fetching: false,
        fetchedProjects: results,
        initiallyLoaded: true,
        hasMore,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({
        fetching: false,
        fetchedProjects: [],
        initiallyLoaded: true,
        fetchError: err as RequestError,
      });
    }
  };

  /**
   * These will fetch projects via API (using project slug) provided by `fetchQueue`
   */
  const fetchSpecificProjects = async () => {
    const queue = fetchQueue.current;

    if (!queue.size) {
      return;
    }

    setState({fetching: true});

    let fetched: Project[] = [];
    let fetchError = null;

    try {
      const {results} = await fetchProjects(api, orgId, {
        slugs: Array.from(queue),
      });
      fetched = results;
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      fetchError = err as RequestError;
    }

    const projectsMap = getProjectsMap(fetched);

    // For each item in the fetch queue, lookup the project object and in the case
    // where something wrong has happened and we were unable to get project summary from
    // the server, just fill in with an object with only the slug
    const projectsOrPlaceholder = Array.from(queue)
      .map(slug => (projectsMap.has(slug) ? projectsMap.get(slug) : {slug}))
      .filter(defined);

    setState({
      fetchedProjects: projectsOrPlaceholder,
      isIncomplete: queue.size !== fetched.length,
      initiallyLoaded: true,
      fetching: false,
      fetchError,
    });

    queue.clear();
  };

  /**
   * When `props.slugs` is included, identifies what projects we already
   * have summaries for and what projects need to be fetched from API
   */
  const loadSpecificProjects = () => {
    const projectsMap = getProjectsMap(projects);

    // Split slugs into projects that are in store and not in store
    // (so we can request projects not in store)
    const [inStore, notInStore] = partition(slugs, slug => projectsMap.has(slug));

    // Get the actual summaries of projects that are in store
    const projectsFromStore = inStore.map(slug => projectsMap.get(slug)).filter(defined);

    // Add to queue
    notInStore.forEach(slug => fetchQueue.current.add(slug));

    setState({
      // placeholders for projects we need to fetch
      fetchedProjects: notInStore.map(slug => ({slug})),
      // set initiallyLoaded if any projects were fetched from store
      initiallyLoaded: !!inStore.length,
      projectsFromStore,
    });

    if (!notInStore.length) {
      return;
    }

    fetchSpecificProjects();
  };

  /**
   * When `props.projectIds` is included, identifies if we already
   * have summaries them, otherwise fetches all projects from API
   */
  const loadSpecificProjectsFromIds = () => {
    const projectsMap = getProjectsIdMap(projects);

    // Split projectIds into projects that are in store and not in store
    // (so we can request projects not in store)
    const [inStore, notInStore] = partition(projectIds, id => projectsMap.has(id));

    if (notInStore.length) {
      loadAllProjects();
      return;
    }

    // Get the actual summaries of projects that are in store
    const projectsFromStore = inStore.map(id => projectsMap.get(id)).filter(defined);

    setState({
      // set initiallyLoaded if any projects were fetched from store
      initiallyLoaded: !!inStore.length,
      projectsFromStore,
    });
  };

  // Equivalent of componentDidMount: perform the initial load once
  useEffect(() => {
    if (slugs?.length) {
      loadSpecificProjects();
    } else if (projectIds?.length) {
      loadSpecificProjectsFromIds();
    } else {
      loadAllProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Equivalent of componentDidUpdate: update projects when the store emits updates
  const prevProjectsRef = useRef(projects);
  useEffect(() => {
    if (prevProjectsRef.current === projects) {
      return;
    }
    prevProjectsRef.current = projects;

    if (allProjects) {
      setState({fetchedProjects: projects});
      return;
    }

    if (slugs?.length) {
      // Extract the requested projects from the store based on props.slugs
      const projectsMap = getProjectsMap(projects);
      const projectsFromStore = slugs.map(slug => projectsMap.get(slug)).filter(defined);
      setState({projectsFromStore});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  /**
   * This is an action provided to consumers for them to update the current projects
   * result set using a simple search query. New results replace the existing list.
   *
   * @param {String} search The search term to use
   */
  const handleSearch = async (search: string) => {
    const {prevSearch, nextCursor: cursor} = state;

    setState({fetching: true});

    try {
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        search,
        limit,
        prevSearch,
        cursor,
      });

      setState({
        fetchedProjects: results,
        hasMore,
        fetching: false,
        prevSearch: search,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      setState({
        fetching: false,
        fetchError: err as RequestError,
      });
    }
  };

  const renderProps = {
    // We want to make sure that at the minimum, we return a list of objects with only `slug`
    // while we load actual project data
    projects: state.initiallyLoaded
      ? [...state.fetchedProjects, ...state.projectsFromStore]
      : slugs?.map(slug => ({slug})) || [],

    // This is set when we fail to find some slugs from both store and API
    isIncomplete: state.isIncomplete,

    // This is state for when fetching data from API
    fetching: state.fetching,

    // Project results (from API) are paginated and there are more projects
    // that are not in the initial queryset
    hasMore: state.hasMore,

    onSearch: handleSearch,

    // Reflects whether or not the initial fetch for the requested projects
    // was fulfilled
    initiallyLoaded: state.initiallyLoaded,

    // The error that occurred if fetching failed
    fetchError: state.fetchError,
  };

  return children(renderProps);
}

type FetchProjectsOptions = {
  cursor?: State['nextCursor'];
  prevSearch?: State['prevSearch'];
  search?: State['prevSearch'];
  slugs?: string[];
} & Pick<Props, 'limit' | 'allProjects'>;

async function fetchProjects(
  api: Client,
  orgId: string,
  {slugs, search, limit, prevSearch, cursor, allProjects}: FetchProjectsOptions = {}
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

  if (slugs?.length) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ? `${query.query} ` : ''}${search}`;
  }

  if (((!prevSearch && !search) || prevSearch === search) && cursor) {
    query.cursor = cursor;
  }

  // "0" shouldn't be a valid value, so this check is fine
  if (limit) {
    query.per_page = limit;
  }

  if (allProjects) {
    const projects = ProjectsStore.getState().projects;
    const loading = ProjectsStore.isLoading();
    // If the projects store is loaded then return all projects from the store
    if (!loading) {
      return {
        results: projects,
        hasMore: false,
      };
    }
    // Otherwise mark the query to fetch all projects from the API
    query.all_projects = 1;
  }

  let hasMore: null | boolean = false;
  let nextCursor: null | string = null;
  const [data, , resp] = await api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/projects/', {
      path: {organizationIdOrSlug: orgId},
    }),
    {
      includeAllArgs: true,
      query,
    }
  );

  const pageLinks = resp?.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore =
      paginationObject &&
      (paginationObject.next!.results || paginationObject.previous!.results);
    nextCursor = paginationObject.next!.cursor;
  }

  // populate the projects store if all projects were fetched
  if (allProjects) {
    ProjectsStore.loadInitialData(data);
  }

  return {
    results: data,
    hasMore,
    nextCursor,
  };
}

interface ProjectAnalyticsData {
  project_age: number;
  project_has_minified_stack_trace: boolean;
  project_has_replay: boolean;
  project_id: number;
  project_platform: string;
}

export function getAnalyicsDataForProject(
  project?: Project | null
): ProjectAnalyticsData {
  return {
    project_has_replay: project?.hasReplays ?? false,
    project_has_minified_stack_trace: project?.hasMinifiedStackTrace ?? false,
    project_age: project ? getDaysSinceDate(project.dateCreated) : -1,
    project_id: project ? parseInt(project.id, 10) : -1,
    project_platform: project?.platform ?? '',
  };
}
