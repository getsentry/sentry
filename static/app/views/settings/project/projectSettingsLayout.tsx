import {cloneElement, isValidElement} from 'react';

import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import ProjectContext from 'sentry/views/projects/projectContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{projectId: string}>;

type InnerProps = Props & {project: Project};

function InnerProjectSettingsLayout({
  params,
  routes,
  project,
  children,
  ...props
}: InnerProps) {
  // set analytics params for route based analytics
  useRouteAnalyticsParams({
    project_id: project.id,
    project_platform: project.platform,
  });

  const organization = useOrganization();

  return (
    <SettingsLayout params={params} routes={routes} {...props}>
      {children && isValidElement(children)
        ? cloneElement<any>(children, {organization, project})
        : children}
    </SettingsLayout>
  );
}

function ProjectSettingsLayout({params, ...props}: Props) {
  return (
    <ProjectContext projectSlug={params.projectId}>
      {({project}) => <InnerProjectSettingsLayout {...{params, project, ...props}} />}
    </ProjectContext>
  );
}

export default ProjectSettingsLayout;
