import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import space from 'app/styles/space';
import AsyncComponent from 'app/components/asyncComponent';
import NotFound from 'app/components/errors/notFound';
import {createDashboard} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';

import {
  DashboardListItem,
  OrgDashboardResponse,
  OrgDashboard,
  DashboardState,
} from './types';
import {PREBUILT_DASHBOARDS} from './data';
import Controls from './controls';
import Dashboard from './dashboard';

type Props = {
  api: Client;
  location: Location;
  params: Params;
  organization: Organization;
};

type State = {
  // local state
  dashboardState: DashboardState;
  changesDashboard: DashboardListItem | undefined;

  // endpoint response
  orgDashboards: OrgDashboardResponse[] | null;
} & AsyncComponent['state'];
class DashboardDetail extends AsyncComponent<Props, State> {
  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],

    // endpoint response
    orgDashboards: [],

    // local state
    dashboardState: 'default',
    changesDashboard: undefined,
  };

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    const url = `/organizations/${organization.slug}/dashboards/`;

    return [['orgDashboards', url]];
  }

  onEdit = () => {
    this.setState({
      dashboardState: 'edit',
    });
  };

  onCreate = () => {
    this.setState({
      dashboardState: 'create',
    });
  };

  onCommit = () => {
    const {api, organization} = this.props;
    const {dashboardState} = this.state;

    switch (dashboardState) {
      case 'create': {
        createDashboard(api, organization.slug).then(() => {
          addSuccessMessage(t('Dashboard created'));

          // re-fetch dashboard list
          this.fetchData();

          this.setState({
            dashboardState: 'default',
          });
        });
        break;
      }
      case 'edit':
      case 'default':
      default: {
        this.setState({
          dashboardState: 'default',
        });
        break;
      }
    }
  };

  getOrgDashboards(): OrgDashboard[] {
    const {orgDashboards} = this.state;

    if (!Array.isArray(orgDashboards)) {
      return [];
    }

    return orgDashboards.map(dashboard => {
      return {
        type: 'org',
        ...dashboard,
      };
    });
  }

  getDashboardsList(): DashboardListItem[] {
    const {orgDashboards} = this.state;

    if (!Array.isArray(orgDashboards)) {
      return PREBUILT_DASHBOARDS;
    }

    const normalizedOrgDashboards: OrgDashboard[] = orgDashboards.map(dashboard => {
      return {
        type: 'org',
        ...dashboard,
      };
    });

    return [...PREBUILT_DASHBOARDS, ...normalizedOrgDashboards];
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
    const {organization} = this.props;

    return (
      <GlobalSelectionHeader
        skipLoadLastUsed={organization.features.includes('global-views')}
      >
        <PageContent>
          <LightWeightNoProjectMessage organization={organization}>
            <StyledPageHeader>
              <div>{t('Dashboards')}</div>
              <Controls
                organization={organization}
                dashboards={this.getDashboardsList()}
                dashboard={dashboard}
                onEdit={this.onEdit}
                onCreate={this.onCreate}
                onCommit={this.onCommit}
                dashboardState={this.state.dashboardState}
              />
            </StyledPageHeader>
            <Dashboard />
          </LightWeightNoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
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

const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  height: 40px;
  margin-bottom: ${space(1)};
`;

export default withOrganization(withApi(DashboardDetail));
