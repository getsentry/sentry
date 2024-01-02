import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import {Organization, Project} from 'sentry/types';

import ProjectMetrics from './projectMetrics';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

function ProjectMetricsContainer(props: Props) {
  return (
    <Feature features={['ddm-ui', 'custom-metrics']}>
      <ProjectMetrics {...props} />
    </Feature>
  );
}

export default ProjectMetricsContainer;
