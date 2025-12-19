import {Outlet} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import useOrganization from 'sentry/utils/useOrganization';

export default function UptimeContainer() {
  const organization = useOrganization();

  return (
    <Feature features={['uptime']} organization={organization} renderDisabled={NoAccess}>
      <NoProjectMessage organization={organization}>
        <PageFiltersContainer>
          <Outlet />
        </PageFiltersContainer>
      </NoProjectMessage>
    </Feature>
  );
}
