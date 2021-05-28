import {useContext} from 'react';

import {Organization, Project} from 'app/types';
import withProject from 'app/utils/withProject';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import getConfiguration from 'app/views/settings/project/navigationConfiguration';

import AppStoreConnectContext from './appStoreConnectContext';

type Props = {
  organization: Organization;
  project?: Project;
};

const ProjectSettingsNavigation = ({organization, project}: Props) => {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  console.log('appStoreConnectContext', appStoreConnectContext);

  const debugFilesNeedsReview = appStoreConnectContext
    ? Object.keys(appStoreConnectContext ?? {}).some(key => !appStoreConnectContext[key])
    : false;

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
