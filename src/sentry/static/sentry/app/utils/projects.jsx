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

    this.loaded = true;

    const [inStore, notInStore] = partition(slugs, slug =>
      [].find(project => project.slug === slug)
    );

    // Check `projects` (from store)
    const projectsFromStore = inStore.map(slug =>
      projects.find(project => project.slug === slug)
    );

    console.log('projectsfromstore', projectsFromStore);
    this.setState({
      projectsFromStore,
    });

    notInStore.forEach(slug => this.fetchQueue.add(slug));

    // placeholders
    this.setState({
      fetchedProjects: notInStore.map(slug => ({slug})),
    });

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

    await new Promise(resolve => setTimeout(resolve, 2500));
    const results = await api.requestPromise(`/organizations/${orgId}/projects/`, {
      query: {
        query: Array.from(this.fetchQueue)
          .map(slug => `slug:${slug}`)
          .join('&'),
      },
    });
    console.log(results);
    // Results is an array of promises that should
    this.setState({
      fetchedProjects: results
        .filter(result => result.length > 0)
        .map(([result]) => result),
      fetching: false,
    });
  }

  render() {
    const {slugs, children} = this.props;
    return children({
      loaded: this.loaded,
      projects: this.loaded
        ? [...this.state.fetchedProjects, ...this.state.projectsFromStore]
        : slugs.map(slug => ({slug})),
      fetching: this.state.fetching,
    });
  }
}

export default withProjects(withApi(Projects));
