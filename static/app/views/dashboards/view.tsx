import {useEffect} from 'react';

import {updateDashboardVisit} from 'sentry/actionCreators/dashboards';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {DashboardDetailWithInjectedProps as DashboardDetail} from './detail';
import {OrgDashboards} from './orgDashboards';
import {DashboardState, type DashboardDetails} from './types';

export default function ViewEditDashboard() {
  const api = useApi();
  const organization = useOrganization();
  const {dashboardId} = useParams<{dashboardId: string}>();
  const location = useLocation();

  const orgSlug = organization.slug;

  useEffect(() => {
    if (dashboardId) {
      updateDashboardVisit(api, orgSlug, dashboardId);
    }
  }, [api, orgSlug, dashboardId]);

  // Get optimistic dashboard from location.state if available (e.g., after adding a widget)
  const optimisticDashboard = (location.state as {dashboard?: DashboardDetails} | null)
    ?.dashboard;

  return (
    <OrgDashboards initialDashboard={optimisticDashboard}>
      {({dashboard, error, onDashboardUpdate}) => {
        return error ? (
          <NotFound />
        ) : dashboard ? (
          <ErrorBoundary>
            <DashboardDetail
              key={dashboard.id}
              initialState={DashboardState.VIEW}
              dashboard={dashboard}
              onDashboardUpdate={onDashboardUpdate}
            />
          </ErrorBoundary>
        ) : (
          <LoadingIndicator />
        );
      }}
    </OrgDashboards>
  );
}
