import {Outlet} from 'react-router';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

export default function DetectorViewContainer() {
  const organization = useOrganization();
  const {detectorId} = useParams<{detectorId?: string}>();

  // A monitor's page shows its own time range. Restoring the last-used filters
  // there can land on a stale absolute range saved on some other page.
  return (
    <PageFiltersContainer skipLoadLastUsed={detectorId !== undefined}>
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </PageFiltersContainer>
  );
}
