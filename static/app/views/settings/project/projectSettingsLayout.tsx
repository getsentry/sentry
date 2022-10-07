import {cloneElement, isValidElement, useMemo} from 'react';
import {RouteComponentProps} from 'react-router';

import * as AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {Organization, Project} from 'sentry/types';
import useRouteAnalyticsParams from 'sentry/utils/useRouteAnalyticsParams';
import withOrganization from 'sentry/utils/withOrganization';
import ProjectContext from 'sentry/views/projects/projectContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

type Props = {
  children: React.ReactNode;
  organization: Organization;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

type InnerProps = Props & {project: Project};

function InnerProjectSettingsLayout({
  params,
  routes,
  project,
  organization,
  children,
  ...props
}: InnerProps) {
  // set analytics params for route based analytics
  useRouteAnalyticsParams(
    // use memoized value to avoid re-rendering
    useMemo(
      () => ({
        project_id: project.id,
        project_platform: project.platform,
      }),
      [project.id, project.platform]
    )
  );
  return (
    <AppStoreConnectContext.Provider project={project} organization={organization}>
      <SettingsLayout
        params={params}
        routes={routes}
        {...props}
        renderNavigation={() => <ProjectSettingsNavigation organization={organization} />}
      >
        {children && isValidElement(children)
          ? cloneElement<any>(children, {organization, project})
          : children}
      </SettingsLayout>
    </AppStoreConnectContext.Provider>
  );
}

function ProjectSettingsLayout({params, ...props}: Props) {
  const {orgId, projectId} = params;

  return (
    <ProjectContext orgId={orgId} projectId={projectId}>
      {({project}) => <InnerProjectSettingsLayout {...{params, project, ...props}} />}
    </ProjectContext>
  );
}

export default withOrganization(ProjectSettingsLayout);
