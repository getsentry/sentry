import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import {Organization, Project} from 'sentry/types';

import ProjectPerformance from './projectPerformance';

type Props = RouteComponentProps<{projectId: string}, {}> & {
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
