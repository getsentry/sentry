import {Project} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';
import useProjects from 'sentry/utils/useProjects';

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

  function Wrapper(props: Props) {
    const {projects, initiallyLoaded} = useProjects();
    const loadingProjects = !initiallyLoaded;

    return <WrappedComponent {...(props as P)} {...{projects, loadingProjects}} />;
  }

  Wrapper.displayName = `withProjects(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withProjects;
