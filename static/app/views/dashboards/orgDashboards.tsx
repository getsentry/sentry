import {browserHistory} from 'react-router';
import {Location} from 'history';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';

import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import NotFound from 'sentry/components/errors/notFound';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {assignTempId} from './layoutUtils';
import {DashboardDetails, DashboardListItem} from './types';
import {hasSavedPageFilters} from './utils';

type OrgDashboardsChildrenProps = {
  dashboard: DashboardDetails | null;
  dashboards: DashboardListItem[];
  error: boolean;
  onDashboardUpdate: (updatedDashboard: DashboardDetails) => void;
};

type Props = WithRouteAnalyticsProps & {
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
      this.props.setEventNames('dashboards2.view', 'Dashboards2: View dashboard');
      this.props.setRouteAnalyticsParams({
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
      const queryParamFilters = new Set([
        'project',
        'environment',
        'statsPeriod',
        'start',
        'end',
        'utc',
        'release',
      ]);
      if (
        stateKey === 'selectedDashboard' &&
        // Only redirect if there are saved filters and none of the filters
        // appear in the query params
        hasSavedPageFilters(data) &&
        isEmpty(
          Object.keys(location.query).filter(unsavedQueryParam =>
            queryParamFilters.has(unsavedQueryParam)
          )
        )
      ) {
        browserHistory.replace({
          ...location,
          query: {
            ...location.query,
            project: data.projects,
            environment: data.environment,
            statsPeriod: data.period,
            start: data.start,
            end: data.end,
            utc: data.utc,
          },
        });
      }
      return;
    }

    // If we don't have a selected dashboard, and one isn't going to arrive
    // we can redirect to the first dashboard in the list.
    const dashboardId = data.length ? data[0].id : 'default-overview';
    browserHistory.replace(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/`,
        query: {
          ...location.query,
        },
      })
    );
  }

  renderLoading() {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  renderBody() {
    const {children} = this.props;
    const {selectedDashboard, error} = this.state;
    let dashboard = selectedDashboard;

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
    const {loading, selectedDashboard} = this.state;

    if (!organization.features.includes('dashboards-basic')) {
      // Redirect to Dashboards v1
      browserHistory.replace(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboards/`,
          query: {
            ...location.query,
          },
        })
      );
      return null;
    }

    if (
      loading &&
      selectedDashboard &&
      hasSavedPageFilters(selectedDashboard) &&
      isEmpty(location.query)
    ) {
      // Block dashboard from rendering if the dashboard has filters and
      // the URL does not contain filters yet. The filters can either match the
      // saved filters, or can be different (i.e. sharing an unsaved state)
      return this.renderLoading();
    }

    return (
      <SentryDocumentTitle title={t('Dashboards')} orgSlug={organization.slug}>
        {super.renderComponent() as React.ReactChild}
      </SentryDocumentTitle>
    );
  }
}

export default withRouteAnalytics(OrgDashboards);
