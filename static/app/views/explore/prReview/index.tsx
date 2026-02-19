import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import useOrganization from 'sentry/utils/useOrganization';

export default function PrReviewPage() {
  const organization = useOrganization();

  return (
    <Feature
      features={['pr-review-dashboard']}
      organization={organization}
      renderDisabled={NoAccess}
    >
      <Outlet />
    </Feature>
  );
}
