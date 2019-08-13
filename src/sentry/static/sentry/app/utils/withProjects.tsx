import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import {Project} from 'app/types';

/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
type Props = {
  projects: Project[];
};

const withProjects = <P extends Props>(WrappedComponent: React.ComponentType<P>) =>
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
