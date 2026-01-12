import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

import ProjectDetail from './projectDetail';

export default function ProjectDetailContainer() {
  const params = useParams<{projectId: string}>();
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === params.projectId);

  useRouteAnalyticsParams(
    project
      ? {
          project_id: project.id,
          project_platform: project.platform,
        }
      : {}
  );

  return (
    <PageAlertProvider>
      <ProjectDetail />
    </PageAlertProvider>
  );
}
