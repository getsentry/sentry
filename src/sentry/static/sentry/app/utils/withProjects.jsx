import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import ProjectsStore from '../stores/projectsStore';
import SentryTypes from '../proptypes';

/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
const withProjects = WrappedComponent =>
  createReactClass({
    displayName: 'withProjects',
    propTypes: {
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
    },
    mixins: [Reflux.listenTo(ProjectsStore, 'onProjectUpdate')],
    getInitialState() {
      return {
        projects: ProjectsStore.getAll(),
      };
    },

    onProjectUpdate() {
      this.setState({
        // TODO(billy): Needs to be updated after max's PR
        projects: Array.from(ProjectsStore.getAll()),
      });
    },
    render() {
      return <WrappedComponent {...this.props} projects={this.state.projects} />;
    },
  });

export default withProjects;
