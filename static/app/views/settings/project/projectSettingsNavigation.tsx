import {useContext} from 'react';

import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {Organization, Project} from 'sentry/types';
import withProject from 'sentry/utils/withProject';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';
import getConfiguration from 'sentry/views/settings/project/navigationConfiguration';

type Props = {
  organization: Organization;
  project?: Project;
};

function ProjectSettingsNavigation({organization, project}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  const debugFilesNeedsReview = appStoreConnectContext
    ? Object.keys(appStoreConnectContext).some(
        key => appStoreConnectContext[key].credentials.status === 'invalid'
      )
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
}

export default withProject(ProjectSettingsNavigation);
