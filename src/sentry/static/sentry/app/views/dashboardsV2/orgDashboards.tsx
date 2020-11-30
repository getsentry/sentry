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

import {PREBUILT_DASHBOARDS} from './data';
import {DashboardListItem, OrgDashboard, OrgDashboardResponse} from './types';

type OrgDashboardsChildrenProps = {
  dashboard: DashboardListItem;
  dashboards: DashboardListItem[];
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
  dashboards: OrgDashboardResponse[] | null;
} & AsyncComponent['state'];

class OrgDashboards extends AsyncComponent<Props, State> {
  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],

    // endpoint response
    dashboards: [],
  };

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    const url = `/organizations/${organization.slug}/dashboards/`;

    return [['dashboards', url]];
  }

  getOrgDashboards(): OrgDashboard[] {
    const {dashboards} = this.state;

    if (!Array.isArray(dashboards)) {
      return [];
    }

    return dashboards.map(dashboard => {
      return {
        type: 'org',
        ...dashboard,
      };
    });
  }

  getCurrentDashboard(): DashboardListItem | undefined {
    const {params} = this.props;
    const dashboardId = params.dashboardId as string | undefined;
    const orgDashboards = this.getOrgDashboards();

    if (typeof dashboardId === 'string') {
      return orgDashboards.find(dashboard => {
        return dashboard.id === dashboardId;
      });
    }

    return PREBUILT_DASHBOARDS[0];
  }

  getDashboardsList(): DashboardListItem[] {
    const {dashboards} = this.state;

    if (!Array.isArray(dashboards)) {
      return PREBUILT_DASHBOARDS;
    }

    const normalizedOrgDashboards: OrgDashboard[] = dashboards.map(dashboard => {
      return {
        type: 'org',
        ...dashboard,
      };
    });

    return [...PREBUILT_DASHBOARDS, ...normalizedOrgDashboards];
  }

  renderBody() {
    const dashboard = this.getCurrentDashboard();

    if (!dashboard) {
      return <NotFound />;
    }

    return this.renderContent(dashboard);
  }

  renderError(error: Error) {
    const notFound = Object.values(this.state.errors).find(
      resp => resp && resp.status === 404
    );

    if (notFound) {
      return <NotFound />;
    }

    return super.renderError(error, true, true);
  }

  renderContent(dashboard: DashboardListItem) {
    const {organization, children} = this.props;

    return (
      <PageContent>
        <LightWeightNoProjectMessage organization={organization}>
          {children({
            dashboard,
            dashboards: this.getDashboardsList(),
            reloadData: this.reloadData.bind(this),
          })}
        </LightWeightNoProjectMessage>
      </PageContent>
    );
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
