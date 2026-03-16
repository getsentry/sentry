import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Redirect} from 'sentry/components/redirect';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

export default function TracesPage() {
  const organization = useOrganization();

  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/traces/',
    newPathPrefix: '/explore/traces/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <Feature
      features={['visibility-explore-view']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </Feature>
  );
}
