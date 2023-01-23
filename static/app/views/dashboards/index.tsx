import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';
import {DashboardState} from './types';
import {DashboardBasicFeature} from './view';

type Props = RouteComponentProps<{}, {}> & {
  api: Client;
  children: React.ReactNode;
  organization: Organization;
};

function DashboardsV2Container(props: Props) {
  const {organization, api, location, children} = props;

  if (organization.features.includes('dashboards-edit')) {
    return <Fragment>{children}</Fragment>;
  }
  const params = {...props.params, orgId: organization.slug};

  return (
    <DashboardBasicFeature organization={organization}>
      <OrgDashboards
        api={api}
        location={location}
        params={params}
        organization={organization}
      >
        {({dashboard, dashboards, error, onDashboardUpdate}) => {
          return error ? (
            <NotFound />
          ) : dashboard ? (
            <ErrorBoundary>
              <DashboardDetail
                {...props}
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

export default withApi(withOrganization(DashboardsV2Container));
