import {ProjectSdkUpdates} from 'sentry/types';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';

import ProjectDetail from './projectDetail';

type Props = Omit<
  React.ComponentProps<typeof ProjectDetail>,
  'projects' | 'loadingProjects' | 'selection'
> & {sdkUpdates: ProjectSdkUpdates[] | null};

function ProjectDetailContainer(props: Props) {
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === props.params.projectId);
  useRouteAnalyticsParams(
    project
      ? {
          project_id: project.id,
          project_platform: project.platform,
        }
      : {}
  );
  return <ProjectDetail {...props} />;
}

export default withSdkUpdates(withOrganization(ProjectDetailContainer));
