import {Outlet} from 'react-router-dom';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

export default function AlertsContainer() {
  const organization = useOrganization();

  const redirectPath = useRedirectNavV2Routes({
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
