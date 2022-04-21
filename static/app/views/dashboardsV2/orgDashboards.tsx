import * as React from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import NotFound from 'sentry/components/errors/notFound';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';

import {assignTempId} from './layoutUtils';
import {DashboardDetails, DashboardListItem} from './types';

type OrgDashboardsChildrenProps = {
  dashboard: DashboardDetails | null;
  dashboards: DashboardListItem[];
  error: boolean;
  onDashboardUpdate: (updatedDashboard: DashboardDetails) => void;
};

type Props = {
  api: Client;
  children: (props: OrgDashboardsChildrenProps) => React.ReactNode;
  location: Location;
  organization: Organization;
  params: {orgId: string; dashboardId?: string};
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
    errors: {},

    dashboards: [],
    selectedDashboard: null,
  };

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.params.dashboardId, this.props.params.dashboardId)) {
      this.remountComponent();
    }
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, params} = this.props;
    const url = `/organizations/${organization.slug}/dashboards/`;
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [['dashboards', url]];

    if (params.dashboardId) {
      endpoints.push(['selectedDashboard', `${url}${params.dashboardId}/`]);
      trackAnalyticsEvent({
        eventKey: 'dashboards2.view',
        eventName: 'Dashboards2: View dashboard',
        organization_id: parseInt(this.props.organization.id, 10),
        dashboard_id: params.dashboardId,
      });
    }

    return endpoints;
  }

  onDashboardUpdate(updatedDashboard: DashboardDetails) {
    this.setState({selectedDashboard: updatedDashboard});
  }

  getDashboards(): DashboardListItem[] {
    const {dashboards} = this.state;

    return Array.isArray(dashboards) ? dashboards : [];
  }

  onRequestSuccess({stateKey, data}) {
    const {params, organization, location} = this.props;

    if (params.dashboardId || stateKey === 'selectedDashboard') {
      return;
    }

    // If we don't have a selected dashboard, and one isn't going to arrive
    // we can redirect to the first dashboard in the list.
    const dashboardId = data.length ? data[0].id : 'default-overview';
    const url = `/organizations/${organization.slug}/dashboard/${dashboardId}/`;
    browserHistory.replace({
      pathname: url,
      query: {
        ...location.query,
      },
    });
  }

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  renderBody() {
    const {children, organization} = this.props;
    const {selectedDashboard, error} = this.state;
    let dashboard = selectedDashboard;

    if (organization.features.includes('dashboard-grid-layout')) {
      // Ensure there are always tempIds for grid layout
      // This is needed because there are cases where the dashboard
      // renders before the onRequestSuccess setState is processed
      // and will caused stacked widgets because of missing tempIds
      dashboard = selectedDashboard
        ? {
            ...selectedDashboard,
            widgets: selectedDashboard.widgets.map(assignTempId),
          }
        : null;
    }

    return children({
      error,
      dashboard,
      dashboards: this.getDashboards(),
      onDashboardUpdate: (updatedDashboard: DashboardDetails) =>
        this.onDashboardUpdate(updatedDashboard),
    });
  }

  renderError(error: Error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );

    if (notFound) {
      return <NotFound />;
    }

    return super.renderError(error, true);
  }

  renderComponent() {
    const {organization, location} = this.props;

    if (!organization.features.includes('dashboards-basic')) {
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
      <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
        {super.renderComponent() as React.ReactChild}
      </SentryDocumentTitle>
    );
  }
}

export default OrgDashboards;
