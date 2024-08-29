import Feature from 'sentry/components/acl/feature';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import ProjectMetrics from './projectMetrics';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

function ProjectMetricsContainer(props: Props) {
  return (
    <Feature features={['custom-metrics']}>
      <ProjectMetrics {...props} />
    </Feature>
  );
}

export default ProjectMetricsContainer;
