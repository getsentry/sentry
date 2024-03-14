import {Component} from 'react';

import {SentryPropTypeValidators} from 'sentry/sentryPropTypeValidators';
import type {Project} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedProjectProps = {
  project?: Project;
};

/**
 * Currently wraps component with project from context
 */
const withProject = <P extends InjectedProjectProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends Component<
    Omit<P, keyof InjectedProjectProps> & Partial<InjectedProjectProps>
  > {
    static displayName = `withProject(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      project: SentryPropTypeValidators.isProject,
    };
    declare context: {project: Project};

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
