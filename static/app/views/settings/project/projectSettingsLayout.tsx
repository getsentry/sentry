import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import ProjectContext from 'app/views/projects/projectContext';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import ProjectSettingsNavigation from 'app/views/settings/project/projectSettingsNavigation';

import * as AppStoreConnectContext from './appStoreConnectContext';

type Props = {
  organization: Organization;
  children: React.ReactNode;
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
        <AppStoreConnectContext.Provider project={project} orgSlug={orgId}>
          <SettingsLayout
            params={params}
            routes={routes}
            {...props}
            renderNavigation={() => (
              <ProjectSettingsNavigation organization={organization} />
            )}
          >
            {children && React.isValidElement(children)
              ? React.cloneElement(children, {
                  organization,
                })
              : children}
          </SettingsLayout>
        </AppStoreConnectContext.Provider>
      )}
    </ProjectContext>
  );
}

export default withOrganization(ProjectSettingsLayout);
