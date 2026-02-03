import {Outlet} from 'react-router-dom';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import useOrganization from 'sentry/utils/useOrganization';

export default function CronsContainer() {
  const organization = useOrganization();

  return (
    <NoProjectMessage organization={organization}>
      <PageFiltersContainer>
        <Outlet />
      </PageFiltersContainer>
    </NoProjectMessage>
  );
}
