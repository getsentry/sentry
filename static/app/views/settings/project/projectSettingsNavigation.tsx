import {useContext} from 'react';

import AppStoreConnectContext from 'app/components/projects/appStoreConnectContext';
import {Organization, Project} from 'app/types';
import withProject from 'app/utils/withProject';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import getConfiguration from 'app/views/settings/project/navigationConfiguration';

type Props = {
  organization: Organization;
  project?: Project;
};

const ProjectSettingsNavigation = ({organization, project}: Props) => {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  const debugFilesNeedsReview = !!appStoreConnectContext?.updateAlertMessage;

  return (
    <SettingsNavigation
      navigationObjects={getConfiguration({project, organization, debugFilesNeedsReview})}
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      organization={organization}
      project={project}
    />
  );
};

export default withProject(ProjectSettingsNavigation);
