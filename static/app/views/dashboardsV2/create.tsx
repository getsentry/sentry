import React, {useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import {EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import {DashboardState, Widget} from './types';
import {cloneDashboard, constructWidgetFromQuery} from './utils';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

function CreateDashboard(props: Props) {
  const {organization, location} = props;
  const [newWidget, setNewWidget] = useState<Widget | undefined>();
  function renderDisabled() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  const dashboard = cloneDashboard(EMPTY_DASHBOARD);
  useEffect(() => {
    const constructedWidget = constructWidgetFromQuery(location.query);
    setNewWidget(constructedWidget);
    if (constructedWidget) {
      browserHistory.replace(location.pathname);
    }
  }, [organization.slug]);
  return (
    <Feature
      features={['dashboards-edit']}
      organization={props.organization}
      renderDisabled={renderDisabled}
    >
      <DashboardDetail
        {...props}
        initialState={DashboardState.CREATE}
        dashboard={dashboard}
        dashboards={[]}
        newWidget={newWidget}
      />
    </Feature>
  );
}

export default withOrganization(CreateDashboard);
