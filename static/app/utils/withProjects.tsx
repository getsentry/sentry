import * as React from 'react';

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
function withProjects<P extends InjectedProjectsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithProjects extends React.Component<
    Omit<P, keyof InjectedProjectsProps> & Partial<InjectedProjectsProps>,
    State
  > {
    static displayName = `withProjects(${getDisplayName(WrappedComponent)})`;

    state: State = ProjectsStore.getState();

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = ProjectsStore.listen(
      () => this.setState(ProjectsStore.getState()),
      undefined
    );

    render() {
      return (
        <WrappedComponent
          {...(this.props as P)}
          projects={this.state.projects}
          loadingProjects={this.state.loading}
        />
      );
    }
  }

  return WithProjects;
}

export default withProjects;
