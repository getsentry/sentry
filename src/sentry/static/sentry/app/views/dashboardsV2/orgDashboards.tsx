import React from 'react';
import {browserHistory} from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {Client} from 'app/api';
import AsyncComponent from 'app/components/asyncComponent';
import NotFound from 'app/components/errors/notFound';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';

import {DashboardDetails, DashboardListItem} from './types';

type OrgDashboardsChildrenProps = {
  dashboard: DashboardDetails | null;
  dashboards: DashboardListItem[];
  error: boolean;
  reloadData: () => void;
};

type Props = {
  api: Client;
  location: Location;
  params: Params;
  organization: Organization;
  children: (props: OrgDashboardsChildrenProps) => React.ReactNode;
};

type State = {
  // endpoint response
  dashboards: DashboardListItem[] | null;
  /**
   * The currently selected dashboard.
   */
  selectedDashboard: DashboardDetails | null;
} & AsyncComponent['state'];

class OrgDashboards extends AsyncComponent<Props, State> {
  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],

    dashboards: [],
    selectedDashboard: null,
  };

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, params} = this.props;
    const url = `/organizations/${organization.slug}/dashboards/`;
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [['dashboards', url]];

    if (params.dashboardId) {
      endpoints.push(['selectedDashboard', `${url}${params.dashboardId}/`]);
    }

    return endpoints;
  }

  getDashboards(): DashboardListItem[] {
    const {dashboards} = this.state;

    return Array.isArray(dashboards) ? dashboards : [];
  }

  onRequestSuccess({stateKey, data}) {
    const {params, organization} = this.props;
    if (params.dashboardId || stateKey === 'selectedDashboard') {
      return;
    }

    // If we don't have a selected dashboard, and one isn't going to arrive
    // we can redirect to the first dashboard in the list.
    const dashboardId = data.length ? data[0].id : 'default-overview';
    const url = `/organizations/${organization.slug}/dashboards/${dashboardId}/`;
    browserHistory.replace({pathname: url});
  }

  renderBody() {
    const {organization, children} = this.props;
    const {selectedDashboard, error} = this.state;

    return (
      <PageContent>
        <LightWeightNoProjectMessage organization={organization}>
          {children({
            error,
            dashboard: selectedDashboard,
            dashboards: this.getDashboards(),
            reloadData: this.reloadData.bind(this),
          })}
        </LightWeightNoProjectMessage>
      </PageContent>
    );
  }

  renderError(error: Error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );
    console.log('render error');

    if (notFound) {
      return <NotFound />;
    }

    return super.renderError(error, true, true);
  }

  renderComponent() {
    const {organization, location} = this.props;

    if (!organization.features.includes('dashboards-v2')) {
      // Redirect to Dashboards v1
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: {
          ...location.query,
        },
      });
      return null;
    }

    return (
      <SentryDocumentTitle title={t('Dashboards')} objSlug={organization.slug}>
        {super.renderComponent()}
      </SentryDocumentTitle>
    );
  }
}

export default OrgDashboards;
