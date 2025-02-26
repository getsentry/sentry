import Redirect from 'sentry/components/redirect';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(
  props: Omit<
    React.ComponentProps<typeof ProjectDetail>,
    'projects' | 'loadingProjects' | 'selection'
  >
) {
  const {organization} = props;
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

  if (
    project?.platform === 'php-laravel' &&
    organization.features.includes('laravel-insights')
  ) {
    return (
      <Redirect
        to={`/organizations/${organization.slug}/insights/backend?project=${project.id}`}
      />
    );
  }

  return <ProjectDetail {...props} />;
}

export default withOrganization(ProjectDetailContainer);
