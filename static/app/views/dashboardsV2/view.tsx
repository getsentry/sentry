import React, {useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {updateDashboardVisit} from 'app/actionCreators/dashboards';
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
import {DashboardState, Widget} from './types';
import {constructWidgetFromQuery} from './utils';

type Props = RouteComponentProps<{orgId: string; dashboardId: string}, {}> & {
  api: Client;
  organization: Organization;
  children: React.ReactNode;
};

function ViewEditDashboard(props: Props) {
  const {api, organization, params, location} = props;
  const dashboardId = params.dashboardId;
  const orgSlug = organization.slug;
  const [newWidget, setNewWidget] = useState<Widget | undefined>();

  useEffect(() => {
    if (dashboardId && dashboardId !== 'default-overview') {
      updateDashboardVisit(api, orgSlug, dashboardId);
    }

    const constructedWidget = constructWidgetFromQuery(location.query);
    setNewWidget(constructedWidget);
    // Clean up url after constructing widget from query string
    if (constructedWidget) {
      browserHistory.replace(location.pathname);
    }
  }, [api, orgSlug, dashboardId]);

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
              initialState={newWidget ? DashboardState.EDIT : DashboardState.VIEW}
              dashboard={dashboard}
              dashboards={dashboards}
              reloadData={(...args) => {
                if (newWidget) {
                  setNewWidget(undefined);
                }
                return reloadData(...args);
              }}
              newWidget={newWidget}
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
