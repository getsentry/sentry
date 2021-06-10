import * as React from 'react';
import createReactClass from 'create-react-class';
import xor from 'lodash/xor';
import Reflux from 'reflux';

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
const withProjectsSpecified = <P extends InjectedProjectsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<Props & Omit<P, keyof InjectedProjectsProps>, State>({
    displayName: `withProjectsSpecified(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(ProjectsStore, 'onProjectUpdate') as any],
    getInitialState() {
      return ProjectsStore.getState(this.props.specificProjectSlugs);
    },

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
      const {specificProjectSlugs} = this.props;

      if (xor(nextProps.specificProjectSlugs, specificProjectSlugs).length) {
        this.setState(ProjectsStore.getState(nextProps.specificProjectSlugs));
      }
    },

    onProjectUpdate() {
      this.setState(ProjectsStore.getState(this.props.specificProjectSlugs));
    },
    render() {
      return (
        <WrappedComponent
          {...(this.props as P)}
          projects={this.state.projects as Project[]}
          loadingProjects={this.state.loading}
        />
      );
    },
  });

export default withProjectsSpecified;
