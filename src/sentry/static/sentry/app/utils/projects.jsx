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
    fetching: false,
    isIncomplete: false,
  };

  componentDidMount() {
    this.getDetails();
  }

  componentDidUpdate() {}

  loaded = false;
  fetchQueue = new Set();

  getDetails() {
    const {slugs, projects} = this.props;

    // check if projects store has any items, if not we should wait
    if (!projects.length) {
      return;
    }

    const [inStore, notInStore] = partition(slugs, slug =>
      [].find(project => project.slug === slug)
    );

    // Check `projects` (from store)
    const projectsFromStore = inStore.map(slug =>
      projects.find(project => project.slug === slug)
    );

    notInStore.forEach(slug => this.fetchQueue.add(slug));

    this.setState({
      // placeholders
      fetchedProjects: notInStore.map(slug => ({slug})),
      projectsFromStore,
    });

    this.fetchProjects();
    this.loaded = true;
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

    // Results is an array of promises that should
    this.setState({
      fetchedProjects: projectsOrPlaceholder,
      isIncomplete: this.fetchQueue.size && this.fetchQueue.size !== results.length,
      fetching: false,
    });

    this.fetchQueue.clear();
  }

  render() {
    const {slugs, children} = this.props;
    return children({
      loaded: this.loaded,
      projects: this.loaded
        ? [...this.state.fetchedProjects, ...this.state.projectsFromStore]
        : slugs.map(slug => ({slug})),
      isIncomplete: this.state.isIncomplete,
      fetching: this.state.fetching,
    });
  }
}

export default withProjects(withApi(Projects));
