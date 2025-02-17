import {useEffect, useState} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import withOrganization from 'sentry/utils/withOrganization';

import {EMPTY_DASHBOARD, getDashboardTemplates} from './data';
import DashboardDetail from './detail';
import type {Widget} from './types';
import {DashboardState} from './types';
import {cloneDashboard, constructWidgetFromQuery} from './utils';

type Props = RouteComponentProps<{templateId?: string; widgetId?: string}> & {
  children: React.ReactNode;
  organization: Organization;
};

function CreateDashboard(props: Props) {
  const {location, organization} = props;
  const {templateId} = props.params;
  const [newWidget, setNewWidget] = useState<Widget | undefined>();
  function renderDisabled() {
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert type="warning">{t("You don't have access to this feature")}</Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  const template = templateId
    ? getDashboardTemplates(organization).find(
        dashboardTemplate => dashboardTemplate.id === templateId
      )
    : undefined;
  const dashboard = template ? cloneDashboard(template) : cloneDashboard(EMPTY_DASHBOARD);
  const initialState = template ? DashboardState.PREVIEW : DashboardState.CREATE;
  useEffect(() => {
    const constructedWidget = constructWidgetFromQuery(location.query);
    setNewWidget(constructedWidget);
    if (constructedWidget) {
      browserHistory.replace(location.pathname);
    }
  }, [location.pathname, location.query]);

  return (
    <Feature
      features="dashboards-edit"
      organization={props.organization}
      renderDisabled={renderDisabled}
    >
      <ErrorBoundary>
        <DashboardDetail
          {...props}
          initialState={initialState}
          dashboard={dashboard}
          dashboards={[]}
          newWidget={newWidget}
          onSetNewWidget={() => setNewWidget(undefined)}
        />
      </ErrorBoundary>
    </Feature>
  );
}

export default withOrganization(CreateDashboard);
