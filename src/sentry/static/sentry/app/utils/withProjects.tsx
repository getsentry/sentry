import * as React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import {Project} from 'app/types';

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
