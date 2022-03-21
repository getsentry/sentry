import {useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import {DASHBOARDS_TEMPLATES, EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import {DashboardState, Widget} from './types';
import {cloneDashboard, constructWidgetFromQuery} from './utils';

type Props = RouteComponentProps<{orgId: string; templateId?: string}, {}> & {
  children: React.ReactNode;
  organization: Organization;
};

function CreateDashboard(props: Props) {
  const {location} = props;
  const {templateId} = props.params;
  const [newWidget, setNewWidget] = useState<Widget | undefined>();
  function renderDisabled() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  const template = templateId
    ? DASHBOARDS_TEMPLATES.find(dashboardTemplate => dashboardTemplate.id === templateId)
    : undefined;
  const dashboard = template ? cloneDashboard(template) : cloneDashboard(EMPTY_DASHBOARD);
  const initialState = template ? DashboardState.PREVIEW : DashboardState.CREATE;
  useEffect(() => {
    const constructedWidget = constructWidgetFromQuery(location.query);
    setNewWidget(constructedWidget);
    if (constructedWidget) {
      browserHistory.replace(location.pathname);
    }
  }, [location.pathname]);
  return (
    <Feature
      features={['dashboards-edit']}
      organization={props.organization}
      renderDisabled={renderDisabled}
    >
      <DashboardDetail
        {...props}
        initialState={initialState}
        dashboard={dashboard}
        dashboards={[]}
        newWidget={newWidget}
      />
    </Feature>
  );
}

export default withOrganization(CreateDashboard);
