import * as React from 'react';
import isEqual from 'lodash/isEqual';

import ProjectsStore from 'app/stores/projectsStore';
import {Project} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type Props = {
  projects?: Project[];
  specificProjectSlugs?: string[];
};

type InjectedProjectsProps = {
  loadingProjects: boolean;
} & Props;

type State = {
  projects: Project[];
  loading: boolean;
};

/**
 * Higher order component that takes specificProjectSlugs and provides list of that projects from ProjectsStore
 */
function withProjectsSpecified<P extends InjectedProjectsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithProjectsSpecified extends React.Component<
    Props & Omit<P, keyof InjectedProjectsProps>,
    State
  > {
    static displayName = `withProjectsSpecified(${getDisplayName(WrappedComponent)})`;

    state = ProjectsStore.getState(this.props.specificProjectSlugs);

    static getDerivedStateFromProps(nextProps: Readonly<Props>): State {
      return ProjectsStore.getState(nextProps.specificProjectSlugs);
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = ProjectsStore.listen(() => {
      const storeState = ProjectsStore.getState(this.props.specificProjectSlugs);

      if (!isEqual(this.state, storeState)) {
        this.setState(storeState);
      }
    }, undefined);

    render() {
      return (
        <WrappedComponent
          {...(this.props as P)}
          projects={this.state.projects as Project[]}
          loadingProjects={this.state.loading}
        />
      );
    }
  }

  return WithProjectsSpecified;
}

export default withProjectsSpecified;
