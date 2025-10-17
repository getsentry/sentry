import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import useOrganization from 'sentry/utils/useOrganization';

export default function PreventPage() {
  const organization = useOrganization();

  return (
    <Feature
      features={['prevent-ai']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <Outlet />
    </Feature>
  );
}
