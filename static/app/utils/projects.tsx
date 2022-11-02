import {Component} from 'react';
import memoize from 'lodash/memoize';
import partition from 'lodash/partition';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'sentry/api';
import ProjectsStore from 'sentry/stores/projectsStore';
import {AvatarProject, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import RequestError from 'sentry/utils/requestError/requestError';
import withApi from 'sentry/utils/withApi';
import withProjects from 'sentry/utils/withProjects';

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
   * Calls API and searches for project, accepts a callback function with signature:
   * fn(searchTerm, {append: bool})
   */
  onSearch: (searchTerm: string, options: {append: boolean}) => void;

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

type DefaultProps = {
  /**
   * If slugs is passed, forward placeholder objects with slugs while fetching
   */
  passthroughPlaceholderProject?: boolean;
};

type Props = {
  api: Client;

  children: RenderFunc;

  /**
   * Organization slug
   */
  orgId: string;

  /**
   * List of projects that have we already have summaries for (i.e. from store)
   */
  projects: Project[];

  /**
   * Whether to fetch all the projects in the organization of which the user
   * has access to
   * */
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
} & DefaultProps;

class BaseProjects extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    passthroughPlaceholderProject: true,
  };

  state: State = {
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

  componentDidMount() {
    const {slugs, projectIds} = this.props;

    if (slugs?.length) {
      this.loadSpecificProjects();
    } else if (projectIds?.length) {
      this.loadSpecificProjectsFromIds();
    } else {
      this.loadAllProjects();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {projects} = this.props;

    if (projects !== prevProps.projects) {
      this.updateProjectsFromStore();
    }
  }

  /**
   * Function to update projects when the store emits updates
   */
  updateProjectsFromStore() {
    const {allProjects, projects, slugs} = this.props;

    if (allProjects) {
      this.setState({fetchedProjects: projects});
      return;
    }

    if (slugs?.length) {
      // Extract the requested projects from the store based on props.slugs
      const projectsMap = this.getProjectsMap(projects);
      const projectsFromStore = slugs.map(slug => projectsMap.get(slug)).filter(defined);
      this.setState({projectsFromStore});
    }
  }

  /**
   * List of projects that need to be fetched via API
   */
  fetchQueue: Set<string> = new Set();

  /**
   * Memoized function that returns a `Map<project.slug, project>`
   */
  getProjectsMap: (projects: Project[]) => Map<string, Project> = memoize(
    projects => new Map(projects.map(project => [project.slug, project]))
  );

  /**
   * Memoized function that returns a `Map<project.id, project>`
   */
  getProjectsIdMap: (projects: Project[]) => Map<number, Project> = memoize(
    projects => new Map(projects.map(project => [parseInt(project.id, 10), project]))
  );

  /**
   * When `props.slugs` is included, identifies what projects we already
   * have summaries for and what projects need to be fetched from API
   */
  loadSpecificProjects = () => {
    const {slugs, projects} = this.props;

    const projectsMap = this.getProjectsMap(projects);

    // Split slugs into projects that are in store and not in store
    // (so we can request projects not in store)
    const [inStore, notInStore] = partition(slugs, slug => projectsMap.has(slug));

    // Get the actual summaries of projects that are in store
    const projectsFromStore = inStore.map(slug => projectsMap.get(slug)).filter(defined);

    // Add to queue
    notInStore.forEach(slug => this.fetchQueue.add(slug));

    this.setState({
      // placeholders for projects we need to fetch
      fetchedProjects: notInStore.map(slug => ({slug})),
      // set initiallyLoaded if any projects were fetched from store
      initiallyLoaded: !!inStore.length,
      projectsFromStore,
    });

    if (!notInStore.length) {
      return;
    }

    this.fetchSpecificProjects();
  };

  /**
   * When `props.projectIds` is included, identifies if we already
   * have summaries them, otherwise fetches all projects from API
   */
  loadSpecificProjectsFromIds = () => {
    const {projectIds, projects} = this.props;

    const projectsMap = this.getProjectsIdMap(projects);

    // Split projectIds into projects that are in store and not in store
    // (so we can request projects not in store)
    const [inStore, notInStore] = partition(projectIds, id => projectsMap.has(id));

    if (notInStore.length) {
      this.loadAllProjects();
      return;
    }

    // Get the actual summaries of projects that are in store
    const projectsFromStore = inStore.map(id => projectsMap.get(id)).filter(defined);

    this.setState({
      // set initiallyLoaded if any projects were fetched from store
      initiallyLoaded: !!inStore.length,
      projectsFromStore,
    });
  };

  /**
   * These will fetch projects via API (using project slug) provided by `this.fetchQueue`
   */
  fetchSpecificProjects = async () => {
    const {api, orgId, passthroughPlaceholderProject} = this.props;

    if (!this.fetchQueue.size) {
      return;
    }

    this.setState({
      fetching: true,
    });

    let projects: Project[] = [];
    let fetchError = null;

    try {
      const {results} = await fetchProjects(api, orgId, {
        slugs: Array.from(this.fetchQueue),
      });
      projects = results;
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      fetchError = err;
    }

    const projectsMap = this.getProjectsMap(projects);

    // For each item in the fetch queue, lookup the project object and in the case
    // where something wrong has happened and we were unable to get project summary from
    // the server, just fill in with an object with only the slug
    const projectsOrPlaceholder: Project[] | ProjectPlaceholder[] = Array.from(
      this.fetchQueue
    )
      .map(slug =>
        projectsMap.has(slug)
          ? projectsMap.get(slug)
          : passthroughPlaceholderProject
          ? {slug}
          : null
      )
      .filter(defined);

    this.setState({
      fetchedProjects: projectsOrPlaceholder,
      isIncomplete: this.fetchQueue.size !== projects.length,
      initiallyLoaded: true,
      fetching: false,
      fetchError,
    });

    this.fetchQueue.clear();
  };

  /**
   * If `props.slugs` is not provided, request from API a list of paginated project summaries
   * that are in `prop.orgId`.
   *
   * Provide render prop with results as well as `hasMore` to indicate there are more results.
   * Downstream consumers should use this to notify users so that they can e.g. narrow down
   * results using search
   */
  loadAllProjects = async () => {
    const {api, orgId, limit, allProjects} = this.props;

    this.setState({
      fetching: true,
    });

    try {
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        limit,
        allProjects,
      });

      this.setState({
        fetching: false,
        fetchedProjects: results,
        initiallyLoaded: true,
        hasMore,
        nextCursor,
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      this.setState({
        fetching: false,
        fetchedProjects: [],
        initiallyLoaded: true,
        fetchError: err,
      });
    }
  };

  /**
   * This is an action provided to consumers for them to update the current projects
   * result set using a simple search query. You can allow the new results to either
   * be appended or replace the existing results.
   *
   * @param {String} search The search term to use
   * @param {Object} options Options object
   * @param {Boolean} options.append Results should be appended to existing list (otherwise, will replace)
   */
  handleSearch = async (search: string, {append}: {append?: boolean} = {}) => {
    const {api, orgId, limit} = this.props;
    const {prevSearch} = this.state;
    const cursor = this.state.nextCursor;

    this.setState({fetching: true});

    try {
      const {results, hasMore, nextCursor} = await fetchProjects(api, orgId, {
        search,
        limit,
        prevSearch,
        cursor,
      });

      this.setState((state: State) => {
        let fetchedProjects;
        if (append) {
          // Remove duplicates
          fetchedProjects = uniqBy(
            [...state.fetchedProjects, ...results],
            ({slug}) => slug
          );
        } else {
          fetchedProjects = results;
        }
        return {
          fetchedProjects,
          hasMore,
          fetching: false,
          prevSearch: search,
          nextCursor,
        };
      });
    } catch (err) {
      console.error(err); // eslint-disable-line no-console

      this.setState({
        fetching: false,
        fetchError: err,
      });
    }
  };

  render() {
    const {slugs, children} = this.props;

    const renderProps = {
      // We want to make sure that at the minimum, we return a list of objects with only `slug`
      // while we load actual project data
      projects: this.state.initiallyLoaded
        ? [...this.state.fetchedProjects, ...this.state.projectsFromStore]
        : (slugs && slugs.map(slug => ({slug}))) || [],

      // This is set when we fail to find some slugs from both store and API
      isIncomplete: this.state.isIncomplete,

      // This is state for when fetching data from API
      fetching: this.state.fetching,

      // Project results (from API) are paginated and there are more projects
      // that are not in the initial queryset
      hasMore: this.state.hasMore,

      // Calls API and searches for project, accepts a callback function with signature:
      //
      // fn(searchTerm, {append: bool})
      onSearch: this.handleSearch,

      // Reflects whether or not the initial fetch for the requested projects
      // was fulfilled
      initiallyLoaded: this.state.initiallyLoaded,

      // The error that occurred if fetching failed
      fetchError: this.state.fetchError,
    };

    return children(renderProps);
  }
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
const Projects = withProjects(withApi(BaseProjects));

export default Projects;

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
    collapse: ['latestDeploys'],
  };

  if (slugs && slugs.length) {
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
    const projects = ProjectsStore.getAll();
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
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/projects/`, {
    includeAllArgs: true,
    query,
  });

  const pageLinks = resp?.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore =
      paginationObject &&
      (paginationObject.next.results || paginationObject.previous.results);
    nextCursor = paginationObject.next.cursor;
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
