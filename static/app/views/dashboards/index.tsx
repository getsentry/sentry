import {Fragment} from 'react';
import {Outlet} from 'react-router-dom';

import ErrorBoundary from 'sentry/components/errorBoundary';
import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOrganization from 'sentry/utils/useOrganization';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';
import {DashboardState} from './types';
import {DashboardBasicFeature} from './view';

export default function DashboardsV2Container() {
  const organization = useOrganization();

  if (organization.features.includes('dashboards-edit')) {
    return (
      <Fragment>
        <Outlet />
      </Fragment>
    );
  }

  return (
    <DashboardBasicFeature organization={organization}>
      <OrgDashboards>
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
