import type {Project} from 'sentry/types/project';
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

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(props as P as any)} {...{projects, loadingProjects}} />;
  }

  Wrapper.displayName = `withProjects(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withProjects;
