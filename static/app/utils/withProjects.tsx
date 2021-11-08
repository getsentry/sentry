import * as React from 'react';

import {Project} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import useProjects from 'app/utils/useProjects';

type InjectedProjectsProps = {
  projects: Project[];
  loadingProjects?: boolean;
};

/**
 * Higher order component that uses ProjectsStore and provides a list of projects
 */
function withProjects<P extends InjectedProjectsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedProjectsProps>;

  const Wrapper: React.FC<Props> = props => {
    const {projects, loadingProjects} = useProjects();

    return <WrappedComponent {...(props as P)} {...{projects, loadingProjects}} />;
  };

  Wrapper.displayName = `withProjects(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withProjects;
