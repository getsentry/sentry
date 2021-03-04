import React from 'react';

import SentryTypes from 'app/sentryTypes';
import {Project} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedProjectProps = {
  project?: Project;
};

/**
 * Currently wraps component with project from context
 */
const withProject = <P extends InjectedProjectProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends React.Component<
    Omit<P, keyof InjectedProjectProps> & Partial<InjectedProjectProps>
  > {
    static displayName = `withProject(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      project: SentryTypes.Project,
    };

    render() {
      const {project, ...props} = this.props;
      return (
        <WrappedComponent
          {...({project: project ?? this.context.project, ...props} as P)}
        />
      );
    }
  };

export default withProject;
