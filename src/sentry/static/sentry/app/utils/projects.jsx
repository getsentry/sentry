import {partition} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import parseLinkHeader from 'app/utils/parseLinkHeader';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

class Projects extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,

    slugs: PropTypes.arrayOf(PropTypes.string),
    limit: PropTypes.number,
  };

  state = {
    fetchedProjects: [],
    projectsFromStore: [],
    initiallyLoaded: false,
    fetching: false,
    isIncomplete: null,
    hasMore: null,
  };

  componentDidMount() {
    const {slugs} = this.props;

    if (slugs && !!slugs.length) {
      this.loadSpecificProjects();
    } else {
      this.loadAllProjects();
    }
  }

  componentDidUpdate() {}

  fetchQueue = new Set();

  loadSpecificProjects = () => {
    const {slugs, projects} = this.props;

    const [inStore, notInStore] = partition(slugs, slug =>
      projects.find(project => project.slug === slug)
    );

    // Check `projects` (from store)
    const projectsFromStore = inStore.map(slug =>
      projects.find(project => project.slug === slug)
    );

    notInStore.forEach(slug => this.fetchQueue.add(slug));

    this.setState({
      // placeholders for projects we need to fetch
      fetchedProjects: notInStore.map(slug => ({slug})),
      initiallyLoaded: true,
      projectsFromStore,
    });

    if (!notInStore.length) {
      return;
    }

    this.fetchSpecificProjects();
  };

  fetchSpecificProjects = async () => {
    const {api, orgId} = this.props;

    if (!this.fetchQueue.size) {
      return;
    }

    this.setState({
      fetching: true,
    });

    let projects = [];

    try {
      const {results} = await fetchProjects(api, orgId, {
        slugs: Array.from(this.fetchQueue),
      });
      projects = results;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    const projectMap = new Map(projects.map(project => [project.slug, project]));

    // For each item in the fetch queue, lookup the project object and in the case
    // where something wrong has happened and we were unable to get project summary from
    // the server, just fill in with an object with only the slug
    const projectsOrPlaceholder = Array.from(this.fetchQueue).map(slug =>
      projectMap.has(slug) ? projectMap.get(slug) : {slug}
    );

    this.setState({
      fetchedProjects: projectsOrPlaceholder,
      isIncomplete: this.fetchQueue.size !== projects.length,
      initiallyLoaded: true,
      fetching: false,
    });

    this.fetchQueue.clear();
  };

  loadAllProjects = async () => {
    const {api, orgId, limit} = this.props;

    this.setState({
      fetching: true,
    });

    try {
      const {results, hasMore} = await fetchProjects(api, orgId, {limit});

      this.setState({
        fetching: false,
        fetchedProjects: results,
        initiallyLoaded: true,
        hasMore,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);

      this.setState({
        fetching: false,
        fetchedProjects: [],
        initiallyLoaded: true,
        fetchError: err,
      });
    }
  };

  handleSearch = async (search, {append} = {}) => {
    const {api, orgId, limit} = this.props;

    try {
      const {results, hasMore} = await fetchProjects(api, orgId, {search, limit});

      this.setState(state => {
        let fetchedProjects;
        if (append) {
          // TODO: dedupe
          fetchedProjects = [...state.fetchedProjects, ...results];
        } else {
          fetchedProjects = results;
        }
        return {
          fetchedProjects,
          hasMore,
          fetching: false,
        };
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  render() {
    const {slugs, children} = this.props;

    return children({
      // May not need to expose this?
      initiallyLoaded: this.state.initiallyLoaded,

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
    });
  }
}

export default withProjects(withApi(Projects));

async function fetchProjects(api, orgId, {slugs, search, limit} = {}) {
  const query = {};

  if (slugs && slugs.length) {
    query.query = slugs.map(slug => `slug:${slug}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ? `${query.query} ` : ''}${search}`;
  }

  // "0" shouldn't be a valid value, so this check is fine
  if (limit) {
    query.per_page = limit;
  }

  let hasMore = false;
  const [results, _, xhr] = await api.requestPromise(
    `/organizations/${orgId}/projects/`,
    {
      includeAllArgs: true,
      query,
    }
  );

  const pageLinks = xhr && xhr.getResponseHeader('Link');

  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore =
      paginationObject &&
      (paginationObject.next.results || paginationObject.previous.results);
  }

  return {
    results,
    hasMore,
  };
}
