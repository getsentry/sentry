import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import ProjectContext from 'app/views/projects/projectContext';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import ProjectSettingsNavigation from 'app/views/settings/project/projectSettingsNavigation';

type Props = {
  organization: Organization;
  children: React.ReactNode;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

function ProjectSettingsLayout({params, organization, children, ...props}: Props) {
  const {orgId, projectId} = params;

  return (
    <ProjectContext orgId={orgId} projectId={projectId}>
      <SettingsLayout
        params={params}
        {...props}
        renderNavigation={() => <ProjectSettingsNavigation organization={organization} />}
      >
        {children && React.isValidElement(children)
          ? React.cloneElement(children, {
              organization,
            })
          : children}
      </SettingsLayout>
    </ProjectContext>
  );
}

export default withOrganization(ProjectSettingsLayout);
