import Feature from 'sentry/components/acl/feature';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import ProjectPerformance from './projectPerformance';

type Props = RouteComponentProps<{projectId: string}> & {
  organization: Organization;
  project: Project;
};

function ProjectPerformanceContainer(props: Props) {
  return (
    <Feature features="performance-view">
      <ProjectPerformance {...props} />
    </Feature>
  );
}

export default ProjectPerformanceContainer;
