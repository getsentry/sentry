import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import {EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import {DashboardState} from './types';
import {cloneDashboard, constructWidgetFromQuery} from './utils';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

function CreateDashboard(props: Props) {
  const {location} = props;
  function renderDisabled() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  const dashboard = cloneDashboard(EMPTY_DASHBOARD);
  const newWidget = constructWidgetFromQuery(location.query);
  if (newWidget) {
    browserHistory.replace(location.pathname);
  }
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
