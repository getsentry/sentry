import {partition} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

class Projects extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    slugs: PropTypes.arrayOf(PropTypes.string).isRequired,
    projects: PropTypes.arrayOf(SentryTypes.Project).isRequired,
  };

  state = {
    fetchedProjects: [],
    projectsFromStore: [],
    initiallyLoaded: false,
    fetching: false,
    isIncomplete: null,
  };

  componentDidMount() {
    this.getDetails();
  }

  componentDidUpdate() {}

  fetchQueue = new Set();

  getDetails() {
    const {slugs, projects} = this.props;

    // check if projects store has any items, if not we should wait
    if (!projects.length) {
      return;
    }

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

    this.fetchProjects();
  }

  async fetchProjects() {
    const {api, orgId} = this.props;

    if (!this.fetchQueue.size) {
      return;
    }

    this.setState({
      fetching: true,
    });

    let results = [];

    try {
      results = await api.requestPromise(`/organizations/${orgId}/projects/`, {
        query: {
          query: Array.from(this.fetchQueue)
            .map(slug => `slug:${slug}`)
            .join(' '),
        },
      });
    } catch (err) {
      results = [];
    }

    const resultMap = new Map(results.map(result => [result.slug, result]));

    // For each item in the fetch queue, lookup the result object and in the case
    // where something wrong has happened and we were unable to get project summary from
    // the server, just fill in with an object with only the slug
    const projectsOrPlaceholder = Array.from(this.fetchQueue).map(slug =>
      resultMap.has(slug) ? resultMap.get(slug) : {slug}
    );

    this.setState({
      fetchedProjects: projectsOrPlaceholder,
      isIncomplete: this.fetchQueue.size !== results.length,
      initiallyLoaded: true,
      fetching: false,
    });

    this.fetchQueue.clear();
  }

  render() {
    const {slugs, children} = this.props;

    return children({
      // May not need to expose this?
      initiallyLoaded: this.state.initiallyLoaded,

      // We want to make sure that at the minimum, we return a list of objects with only `slug`
      // while we load actual project data
      projects: this.state.initiallyLoaded
        ? [...this.state.fetchedProjects, ...this.state.projectsFromStore]
        : slugs.map(slug => ({slug})),

      // This is set when we fail to find some slugs from both store and API
      isIncomplete: this.state.isIncomplete,

      // This is state for when fetching data from API
      fetching: this.state.fetching,
    });
  }
}

export default withProjects(withApi(Projects));
