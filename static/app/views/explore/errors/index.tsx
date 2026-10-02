import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Outlet} from 'sentry/router/reactRouter';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function ErrorsPage() {
  const organization = useOrganization();

  return (
    <Feature
      features={['explore-errors']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </Feature>
  );
}
