import {Outlet} from 'react-router-dom';

import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';

export default function DetectorViewContainer() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <Layout.Page>
      <PageFiltersContainer>
        <Outlet />
      </PageFiltersContainer>
    </Layout.Page>
  );
}
