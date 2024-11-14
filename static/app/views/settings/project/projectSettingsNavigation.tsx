import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import withProject from 'sentry/utils/withProject';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';
import getConfiguration from 'sentry/views/settings/project/navigationConfiguration';

type Props = {
  organization: Organization;
  project?: Project;
};

function ProjectSettingsNavigation({organization, project}: Props) {
  return (
    <SettingsNavigation
      navigationObjects={getConfiguration({
        project,
        organization,
        debugFilesNeedsReview: false,
      })}
      access={new Set(organization.access)}
      features={new Set(organization.features)}
      organization={organization}
      project={project}
    />
  );
}

export default withProject(ProjectSettingsNavigation);
