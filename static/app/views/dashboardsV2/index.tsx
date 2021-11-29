import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'sentry/api';
import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';
import {DashboardState} from './types';
import {DashboardBasicFeature} from './view';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  api: Client;
  organization: Organization;
  children: React.ReactNode;
};

function DashboardsV2Container(props: Props) {
  const {organization, params, api, location, children} = props;

  if (organization.features.includes('dashboards-edit')) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <DashboardBasicFeature organization={organization}>
      <OrgDashboards
        api={api}
        location={location}
        params={params}
        organization={organization}
      >
        {({dashboard, dashboards, error, reloadData}) => {
          return error ? (
            <NotFound />
          ) : dashboard ? (
            <DashboardDetail
              {...props}
              initialState={DashboardState.VIEW}
              dashboard={dashboard}
              dashboards={dashboards}
              reloadData={reloadData}
            />
          ) : (
            <LoadingIndicator />
          );
        }}
      </OrgDashboards>
    </DashboardBasicFeature>
  );
}

export default withApi(withOrganization(DashboardsV2Container));
