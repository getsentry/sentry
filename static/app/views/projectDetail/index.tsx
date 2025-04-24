import Redirect from 'sentry/components/redirect';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';
import {useProjectDetailsRedirect} from 'sentry/views/insights/pages/platform/shared/projectDetailsRedirect';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(
  props: Omit<
    React.ComponentProps<typeof ProjectDetail>,
    'projects' | 'loadingProjects' | 'selection'
  >
) {
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

  const redirect = useProjectDetailsRedirect(project);
  if (project && redirect) {
    return <Redirect to={redirect} />;
  }

  return <ProjectDetail {...props} />;
}

export default withOrganization(ProjectDetailContainer);
