import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';

/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
const withProjects = WrappedComponent =>
  createReactClass({
    displayName: `withProjects(${getDisplayName(WrappedComponent)})`,
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
        projects: ProjectsStore.getAll(),
      });
    },
    render() {
      return <WrappedComponent {...this.props} projects={this.state.projects} />;
    },
  });

export default withProjects;
