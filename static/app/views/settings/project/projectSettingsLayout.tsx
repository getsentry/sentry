import {cloneElement, isValidElement} from 'react';
import {RouteComponentProps} from 'react-router';

import * as AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import ProjectContext from 'sentry/views/projects/projectContext';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import ProjectSettingsNavigation from 'sentry/views/settings/project/projectSettingsNavigation';

type Props = {
  children: React.ReactNode;
  organization: Organization;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

function ProjectSettingsLayout({
  params,
  organization,
  children,
  routes,
  ...props
}: Props) {
  const {orgId, projectId} = params;

  return (
    <ProjectContext orgId={orgId} projectId={projectId}>
      {({project}) => (
        <AppStoreConnectContext.Provider project={project} organization={organization}>
          <SettingsLayout
            params={params}
            routes={routes}
            {...props}
            renderNavigation={() => (
              <ProjectSettingsNavigation organization={organization} />
            )}
          >
            {children && isValidElement(children)
              ? cloneElement(children, {organization, project})
              : children}
          </SettingsLayout>
        </AppStoreConnectContext.Provider>
      )}
    </ProjectContext>
  );
}

export default withOrganization(ProjectSettingsLayout);
