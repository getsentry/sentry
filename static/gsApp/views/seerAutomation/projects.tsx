import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import useOrganization from 'sentry/utils/useOrganization';

export default function SeerAutomationProjects() {
  const organization = useOrganization();

  return (
    <Feature
      features={['seer-settings-gtm']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <div>SeerAutomationProjects</div>
    </Feature>
  );
}
