import {Outlet} from 'react-router';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function DetectorViewContainer() {
  const organization = useOrganization();

  return (
    <PageFiltersContainer>
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </PageFiltersContainer>
  );
}
