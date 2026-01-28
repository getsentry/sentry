import {Outlet, useOutletContext} from 'react-router-dom';

import type {Project} from 'sentry/types/project';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useParams} from 'sentry/utils/useParams';
import ProjectContext from 'sentry/views/projects/projectContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type ProjectSettingsOutletContext = {
  project: Project;
};

function ProjectSettingsOutlet(props: ProjectSettingsOutletContext) {
  return <Outlet context={props} />;
}

export function useProjectSettingsOutlet() {
  return useOutletContext<ProjectSettingsOutletContext>();
}

function InnerProjectSettingsLayout({project}: {project: Project}) {
  // set analytics params for route based analytics
  useRouteAnalyticsParams({
    project_id: project.id,
    project_platform: project.platform,
  });

  return (
    <SettingsLayout>
      <ProjectSettingsOutlet project={project} />
    </SettingsLayout>
  );
}

export default function ProjectSettingsLayout() {
  const params = useParams<{projectId: string}>();

  return (
    <ProjectContext projectSlug={params.projectId}>
      {({project}) => <InnerProjectSettingsLayout project={project} />}
    </ProjectContext>
  );
}
