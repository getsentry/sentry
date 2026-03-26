// test: verifying changedSince
import {Outlet} from 'react-router-dom';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Redirect} from 'sentry/components/redirect';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useRedirectNavigationV2Routes} from 'sentry/views/navigation/useRedirectNavigationV2Routes';

export default function AlertsContainer() {
  const organization = useOrganization();

  const redirectPath = useRedirectNavigationV2Routes({
    oldPathPrefix: '/alerts/',
    newPathPrefix: '/issues/alerts/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return (
    <NoProjectMessage organization={organization}>
      <Outlet />
    </NoProjectMessage>
  );
}
