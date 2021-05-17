import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import NotFound from 'app/components/errors/notFound';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';
import {DashboardState} from './types';

type Props = RouteComponentProps<{orgId: string; dashboardId: string}, {}> & {
  api: Client;
  organization: Organization;
  children: React.ReactNode;
};

function ViewEditDashboard(props: Props) {
  const {organization, params, api, location} = props;
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

export default withApi(withOrganization(ViewEditDashboard));

type FeatureProps = {
  organization: Organization;
  children: React.ReactNode;
};

export const DashboardBasicFeature = ({organization, children}: FeatureProps) => {
  const renderDisabled = () => (
    <PageContent>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </PageContent>
  );

  return (
    <Feature
      hookName="feature-disabled:dashboards-page"
      features={['organizations:dashboards-basic']}
      organization={organization}
      renderDisabled={renderDisabled}
    >
      {children}
    </Feature>
  );
};
