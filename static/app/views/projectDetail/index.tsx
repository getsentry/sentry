import Redirect from 'sentry/components/redirect';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';
import {
  hasLaravelInsightsFeature,
  useIsLaravelInsightsAvailable,
} from 'sentry/views/insights/pages/platform/laravel/features';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(
  props: Omit<
    React.ComponentProps<typeof ProjectDetail>,
    'projects' | 'loadingProjects' | 'selection'
  >
) {
  const {organization} = props;
  const {projects} = useProjects();
  const isLaravelInsightsAvailable = useIsLaravelInsightsAvailable();

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
    hasLaravelInsightsFeature(organization) &&
    isLaravelInsightsAvailable
  ) {
    return (
      <Redirect
        to={`/insights/backend/?project=${project.id}${project.isBookmarked ? '&starred=1' : ''}`}
      />
    );
  }

  return <ProjectDetail {...props} />;
}

export default withOrganization(ProjectDetailContainer);
