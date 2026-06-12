import {Outlet} from 'react-router-dom';

import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function DetectorViewContainer() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <PageFiltersContainer>
      <NoProjectMessage organization={organization}>
        <Outlet />
      </NoProjectMessage>
    </PageFiltersContainer>
  );
}
