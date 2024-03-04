import useAllProjectVisibility from 'sentry/utils/project/useAllProjectVisibility';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import withOrganization from 'sentry/utils/withOrganization';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(
  props: Omit<
    React.ComponentProps<typeof ProjectDetail>,
    'projects' | 'loadingProjects' | 'selection'
  >
) {
  const {getBySlug} = useAllProjectVisibility({});
  const project = getBySlug(props.params.projectId);
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

export default withOrganization(ProjectDetailContainer);
