import {useEffect} from 'react';
import {Outlet} from 'react-router-dom';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function DetectorViewContainer() {
  useWorkflowEngineFeatureGate({redirect: true});

  const api = useApi();
  const organization = useOrganization();

  useEffect(() => {
    fetchOrgMembers(api, organization.slug);
  }, [api, organization.slug]);

  return (
    <PageFiltersContainer>
      <Outlet />
    </PageFiltersContainer>
  );
}
