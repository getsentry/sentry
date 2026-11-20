import {Outlet} from 'react-router';

import {NotFound} from 'sentry/components/errors/notFound';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function ServiceAccountsLayout() {
  const organization = useOrganization();
  if (!organization.features.includes('service-accounts')) {
    return <NotFound />;
  }
  return <Outlet />;
}
