import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

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
 * Higher order component that takes specificProjectSlugs and provides list of that projects from ProjectsStore
 */
const withProjectsSpecified = <P extends InjectedProjectsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedProjectsProps> & Partial<InjectedProjectsProps>,
    State
  >({
    displayName: `withProjectsSpecified(${getDisplayName(WrappedComponent)})`,
    propTypes: {
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
      specificProjectSlugs: PropTypes.arrayOf(PropTypes.string),
    },
    mixins: [Reflux.listenTo(ProjectsStore, 'onProjectUpdate') as any],
    getInitialState() {
      return ProjectsStore.getState(this.props.specificProjectSlugs);
    },

    onProjectUpdate() {
      this.setState(ProjectsStore.getState(this.props.specificProjectSlugs));
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

export default withProjectsSpecified;
