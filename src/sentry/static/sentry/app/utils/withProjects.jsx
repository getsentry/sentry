import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/proptypes';

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
        projects: ProjectsStore.getAll(),
      });
    },
    render() {
      return <WrappedComponent {...this.props} projects={this.state.projects} />;
    },
  });

export default withProjects;
