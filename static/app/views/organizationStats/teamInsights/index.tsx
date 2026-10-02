import Feature from 'sentry/components/acl/feature';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Outlet} from 'sentry/router/reactRouter';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function TeamInsightsContainer() {
  const organization = useOrganization();
  return (
    <Feature organization={organization} features="team-insights">
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </Feature>
  );
}
