import {useContext} from 'react';

import type {Project} from 'sentry/types/project';
import getDisplayName from 'sentry/utils/getDisplayName';
import {ProjectContext} from 'sentry/views/projects/projectContext';

type InjectedProjectProps = {
  project?: Project;
};

function withProject<P extends InjectedProjectProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedProjectProps> & Partial<InjectedProjectProps>;

  function Wrapper(props: Props) {
    const project = useContext(ProjectContext);

    return <WrappedComponent project={project} {...(props as P)} />;
  }

  Wrapper.displayName = `withProject(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withProject;
