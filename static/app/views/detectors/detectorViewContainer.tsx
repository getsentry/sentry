import {Outlet} from 'react-router-dom';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';

export default function MonitorViewContainer() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <PageFiltersContainer>
      <Outlet />
    </PageFiltersContainer>
  );
}
