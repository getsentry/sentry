import {useEffect} from 'react';

import {updateDashboardVisit} from 'sentry/actionCreators/dashboards';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {DashboardState, type DashboardDetails} from 'sentry/views/dashboards/types';
import {useTimeseriesVisualizationEnabled} from 'sentry/views/dashboards/utils/useTimeseriesVisualizationEnabled';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';

export default function ViewEditDashboard() {
  const api = useApi();
  const organization = useOrganization();
  const {dashboardId} = useParams<{dashboardId: string}>();
  const location = useLocation();

  const orgSlug = organization.slug;

  useEffect(() => {
    if (dashboardId && dashboardId !== 'default-overview') {
      updateDashboardVisit(api, orgSlug, dashboardId);
    }
  }, [api, orgSlug, dashboardId]);

  const useTimeseriesVisualization = useTimeseriesVisualizationEnabled();

  // Get optimistic dashboard from location.state if available (e.g., after adding a widget)
  const optimisticDashboard = (location.state as {dashboard?: DashboardDetails} | null)
    ?.dashboard;

  return (
    <DashboardBasicFeature organization={organization}>
      <OrgDashboards initialDashboard={optimisticDashboard}>
        {({dashboard, dashboards, error, onDashboardUpdate}) => {
          return error ? (
            <NotFound />
          ) : dashboard ? (
            <ErrorBoundary>
              <DashboardDetail
                key={dashboard.id}
                initialState={DashboardState.VIEW}
                dashboard={dashboard}
                dashboards={dashboards}
                onDashboardUpdate={onDashboardUpdate}
                useTimeseriesVisualization={useTimeseriesVisualization}
              />
            </ErrorBoundary>
          ) : (
            <LoadingIndicator />
          );
        }}
      </OrgDashboards>
    </DashboardBasicFeature>
  );
}

type FeatureProps = {
  children: React.ReactNode;
  organization: Organization;
};

export function DashboardBasicFeature({organization, children}: FeatureProps) {
  const renderDisabled = () => (
    <Layout.Page withPadding>
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          {t("You don't have access to this feature")}
        </Alert>
      </Alert.Container>
    </Layout.Page>
  );

  return (
    <Feature
      hookName="feature-disabled:dashboards-page"
      features="organizations:dashboards-basic"
      organization={organization}
      renderDisabled={renderDisabled}
    >
      {children}
    </Feature>
  );
}
