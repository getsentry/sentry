import {Outlet, useOutletContext} from 'react-router-dom';

import type {PlainRoute} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import ProjectContext from 'sentry/views/projects/projectContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type InnerProps = {
  params: {projectId: string};
  project: Project;
  routes: PlainRoute[];
};

type ProjectSettingsOutletContext = {
  project: Project;
};

function ProjectSettingsOutlet(props: ProjectSettingsOutletContext) {
  return <Outlet context={props} />;
}

export function useProjectSettingsOutlet() {
  return useOutletContext<ProjectSettingsOutletContext>();
}

function InnerProjectSettingsLayout({params, routes, project}: InnerProps) {
  const location = useLocation();

  // set analytics params for route based analytics
  useRouteAnalyticsParams({
    project_id: project.id,
    project_platform: project.platform,
  });

  return (
    <SettingsLayout
      params={params}
      routes={routes}
      location={location}
      router={undefined as any}
      route={undefined as any}
      routeParams={undefined as any}
    >
      <ProjectSettingsOutlet project={project} />
    </SettingsLayout>
  );
}

export default function ProjectSettingsLayout() {
  const params = useParams<{projectId: string}>();
  const routes = useRoutes();

  return (
    <ProjectContext projectSlug={params.projectId}>
      {({project}) => (
        <InnerProjectSettingsLayout params={params} routes={routes} project={project} />
      )}
    </ProjectContext>
  );
}
