import {useEffect} from 'react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

function MonitorsContainer({children}: {children?: React.ReactNode}) {
  const organization = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (organization.features.includes('insights-crons')) {
      navigate(
        normalizeUrl(`/organizations/${organization.slug}/insights/backend/crons/`),
        {replace: true}
      );
    }
  });

  return (
    <NoProjectMessage organization={organization}>
      <PageFiltersContainer>{children}</PageFiltersContainer>
    </NoProjectMessage>
  );
}

export default MonitorsContainer;
