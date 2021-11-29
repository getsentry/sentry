import React, {useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {updateDashboardVisit} from 'sentry/actionCreators/dashboards';
import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';
import {DashboardState, Widget} from './types';
import {constructWidgetFromQuery} from './utils';

type Props = RouteComponentProps<{orgId: string; dashboardId: string}, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

function ViewEditDashboard(props: Props) {
  const api = useApi();

  const {organization, params, location} = props;
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

export default withOrganization(ViewEditDashboard);

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
