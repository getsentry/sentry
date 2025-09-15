import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

export default function TracesPage() {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/traces/',
    newPathPrefix: '/explore/traces/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <Feature
      features={['performance-trace-explorer', 'visibility-explore-view']}
      requireAll={false}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </Feature>
  );
}
