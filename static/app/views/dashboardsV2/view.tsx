import React, {useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import pick from 'lodash/pick';

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
import {DashboardState, Widget, WidgetQuery} from './types';

type Props = RouteComponentProps<{orgId: string; dashboardId: string}, {}> & {
  api: Client;
  organization: Organization;
  children: React.ReactNode;
};

function ViewEditDashboard(props: Props) {
  const {organization, params, api, location} = props;
  const [newWidget, setNewWidget] = useState<Widget | undefined>();
  useEffect(() => {
    const constructedWidget = constructWidgetFromQuery(location.query);
    setNewWidget(constructedWidget);
    // Clean up url after constructing widget from query string
    // TODO: more elegant way to do this?
    if (constructedWidget) {
      browserHistory.replace(location.pathname);
    }
  }, []);
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

function constructWidgetFromQuery(query): Widget | undefined {
  if (query) {
    const queryNames =
      typeof query.queryNames === 'string' ? [query.queryNames] : query.queryNames;
    const queryConditions =
      typeof query.queryConditions === 'string'
        ? [query.queryConditions]
        : query.queryConditions;
    const queries: WidgetQuery[] = [];
    if (queryConditions)
      queryConditions.forEach((condition, index) => {
        queries.push({
          name: queryNames?.[index],
          conditions: condition,
          fields:
            typeof query.queryFields === 'string'
              ? [query.queryFields]
              : query.queryFields,
          orderby: query.queryOrderby,
        });
      });
    const newWidget: Widget = {
      ...pick(query, ['title', 'displayType', 'interval']),
      queries,
    };
    // TODO: more elegant way to check if newWidget is valid?
    if (Object.keys(newWidget).length === 4) return newWidget;
  }
  return undefined;
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
