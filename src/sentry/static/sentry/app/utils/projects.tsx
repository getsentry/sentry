import PropTypes from 'prop-types';
import * as React from 'react';
import memoize from 'lodash/memoize';
import partition from 'lodash/partition';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'app/api';
import {Project, AvatarProject} from 'app/types';
import {defined} from 'app/utils';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import RequestError from 'app/utils/requestError/requestError';
import SentryTypes from 'app/sentryTypes';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

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
   * Project results (from API) are paginated and there are more projects
   * that are not in the initial queryset
   */
  hasMore: null | boolean;
  prevSearch: null | string;
  nextCursor?: null | string;

  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;
};

export type RenderProps = {
  /**
   * We want to make sure that at the minimum, we return a list of objects with only `slug`
   * while we load actual project data
   */
  projects: Project[] | ProjectPlaceholder[];

  /**
   * Calls API and searches for project, accepts a callback function with signature:
   * fn(searchTerm, {append: bool})
   */
  onSearch: (searchTerm: string, {append: boolean}) => void;
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

  /**
   * Organization slug
   */
  orgId: string;

  /**
   * List of projects that have we already have summaries for (i.e. from store)
   */
  projects: Project[];

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

  children: RenderFunc;
} & DefaultProps;

/**
 * This is a utility component that should be used to fetch an organization's projects (summary).
 * It can either fetch explicit projects (e.g. via slug) or a paginated list of projects.
 * These will be passed down to the render prop (`children`).
 *
 * The legacy way of handling this is that `ProjectSummary[]` is expected to be included in an
 * `Organization` as well as being saved to `ProjectsStore`.
 */
class Projects extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,
    slugs: PropTypes.arrayOf(PropTypes.string),
    limit: PropTypes.number,
    allProjects: PropTypes.bool,
    passthroughPlaceholderProject: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    passthroughPlaceholderProject: true,
  };

  state = {
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
    const {slugs} = this.props;

    if (slugs && !!slugs.length) {
      this.loadSpecificProjects();
    } else {
      this.loadAllProjects();
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
      // set initallyLoaded if any projects were fetched from store
      initiallyLoaded: !!inStore.length,
      projectsFromStore,
    });

    if (!notInStore.length) {
      return;
    }

    this.fetchSpecificProjects();
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
          : !!passthroughPlaceholderProject
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

export default withProjects(withApi(Projects));

type FetchProjectsOptions = {
  slugs?: string[];
  cursor?: State['nextCursor'];
  search?: State['prevSearch'];
  prevSearch?: State['prevSearch'];
} & Pick<Props, 'limit' | 'allProjects'>;

async function fetchProjects(
  api: Client,
  orgId: string,
  {slugs, search, limit, prevSearch, cursor, allProjects}: FetchProjectsOptions = {}
) {
  const query: {
    query?: string;
    cursor?: typeof cursor;
    per_page?: number;
    all_projects?: number;
  } = {};

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
    const {loading, projects} = ProjectsStore.getState();
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
  const [results, , xhr] = await api.requestPromise(`/organizations/${orgId}/projects/`, {
    includeAllArgs: true,
    query,
  });

  const pageLinks = xhr && xhr.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore =
      paginationObject &&
      (paginationObject.next.results || paginationObject.previous.results);
    nextCursor = paginationObject.next.cursor;
  }

  // populate the projects store if all projects were fetched
  if (allProjects) {
    ProjectActions.loadProjects(results);
  }

  return {
    results,
    hasMore,
    nextCursor,
  };
}
