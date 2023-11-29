import {useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import pick from 'lodash/pick';

import {updateDashboardVisit} from 'sentry/actionCreators/dashboards';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import DashboardDetail from './detail';
import OrgDashboards from './orgDashboards';
import {DashboardState, Widget} from './types';
import {constructWidgetFromQuery} from './utils';

const ALLOWED_PARAMS = [
  'start',
  'end',
  'utc',
  'period',
  'project',
  'environment',
  'statsPeriod',
];

type Props = RouteComponentProps<
  {dashboardId: string; orgId: string; widgetId?: number},
  {}
> & {
  children: React.ReactNode;
  organization: Organization;
};

function ViewEditDashboard(props: Props) {
  const api = useApi();

  const {organization, params, location} = props;
  const dashboardId = params.dashboardId;
  const orgSlug = organization.slug;
  const [newWidget, setNewWidget] = useState<Widget | undefined>();
  const [dashboardInitialState, setDashboardInitialState] = useState(DashboardState.VIEW);

  useEffect(() => {
    if (dashboardId && dashboardId !== 'default-overview') {
      updateDashboardVisit(api, orgSlug, dashboardId);
    }
  }, [api, orgSlug, dashboardId]);

  useEffect(() => {
    const constructedWidget = constructWidgetFromQuery(location.query);
    setNewWidget(constructedWidget);
    // Clean up url after constructing widget from query string, only allow GHS params
    if (constructedWidget) {
      setDashboardInitialState(DashboardState.EDIT);
      browserHistory.replace({
        pathname: location.pathname,
        query: pick(location.query, ALLOWED_PARAMS),
      });
    }
  }, [location.pathname, location.query]);

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
                initialState={dashboardInitialState}
                dashboard={dashboard}
                dashboards={dashboards}
                onDashboardUpdate={onDashboardUpdate}
                newWidget={newWidget}
                onSetNewWidget={() => setNewWidget(undefined)}
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

export default withOrganization(ViewEditDashboard);

type FeatureProps = {
  children: React.ReactNode;
  organization: Organization;
};

export function DashboardBasicFeature({organization, children}: FeatureProps) {
  const renderDisabled = () => (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
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
