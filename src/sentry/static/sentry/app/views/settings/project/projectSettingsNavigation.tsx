import React from 'react';

import {Organization, Project} from 'app/types';
import withProject from 'app/utils/withProject';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import getConfiguration from 'app/views/settings/project/navigationConfiguration';

type Props = {
  organization: Organization;
  project: Project;
};

const ProjectSettingsNavigation = ({organization, project}: Props) => (
  <SettingsNavigation
    navigationObjects={getConfiguration({project, organization})}
    access={new Set(organization.access)}
    features={new Set(organization.features)}
    organization={organization}
    project={project}
  />
);

export default withProject(ProjectSettingsNavigation);
