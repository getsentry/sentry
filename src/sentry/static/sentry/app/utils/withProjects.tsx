import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import {Project} from 'app/types';

type InjectedProjectsProps = {
  projects: Project[];
};

type State = {
  projects: Project[];
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
      return {
        projects: ProjectsStore.getAll() as Project[],
      };
    },

    onProjectUpdate() {
      this.setState({
        projects: ProjectsStore.getAll() as Project[],
      });
    },
    render() {
      return <WrappedComponent {...this.props} projects={this.state.projects} />;
    },
  });

export default withProjects;
