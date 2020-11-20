import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import SentryTypes from 'app/sentryTypes';
import ProjectsStore from 'app/stores/projectsStore';
import {Project} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedProjectsProps = {
  projects: Project[];
  loadingProjects?: boolean;
};

type State = {
  projects: Project[];
  loading: boolean;
};

/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
const withProjects = <P extends InjectedProjectsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedProjectsProps> & Partial<InjectedProjectsProps>,
    State
  >({
    displayName: `withProjects(${getDisplayName(WrappedComponent)})`,
    propTypes: {
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
    },
    mixins: [Reflux.listenTo(ProjectsStore, 'onProjectUpdate') as any],
    getInitialState() {
      return ProjectsStore.getState();
    },

    onProjectUpdate() {
      this.setState(ProjectsStore.getState());
    },
    render() {
      return (
        <WrappedComponent
          {...this.props}
          projects={this.state.projects}
          loadingProjects={this.state.loading}
        />
      );
    },
  });

export default withProjects;
