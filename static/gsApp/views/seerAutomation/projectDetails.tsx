import {SeerProjectDetails} from 'sentry/components/seer/projectDetails';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';
import {ProjectSeerContainer as OldProjectDetails} from 'sentry/views/settings/projectSeer/index';

export default function SeerProjectDetailsPage() {
  const organization = useOrganization();
  return showNewSeer(organization) ? <NewProjectDetails /> : <OldProjectDetails />;
}

function NewProjectDetails() {
  const {project} = useProjectSettingsOutlet();
  return <SeerProjectDetails project={project} />;
}
