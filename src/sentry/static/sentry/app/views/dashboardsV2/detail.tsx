import React from 'react';
import {browserHistory} from 'react-router';
import {Params} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import AsyncComponent from 'app/components/asyncComponent';
import NotFound from 'app/components/errors/notFound';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Controls from './controls';
import Dashboard from './dashboard';
import {EMPTY_DASHBOARD, PREBUILT_DASHBOARDS} from './data';
import Title from './title';
import {
  DashboardListItem,
  DashboardState,
  OrgDashboard,
  OrgDashboardResponse,
  Widget,
} from './types';
import {cloneDashboard} from './utils';

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

  onEdit = (dashboard: DashboardListItem) => () => {
    this.setState({
      dashboardState: 'edit',
      changesDashboard: cloneDashboard(dashboard),
    });
  };

  onCreate = () => {
    this.setState({
      dashboardState: 'create',
      changesDashboard: cloneDashboard(EMPTY_DASHBOARD),
    });
  };

  onCancel = () => {
    this.setState({
      dashboardState: 'default',
      changesDashboard: undefined,
    });
  };

  onDelete = (dashboard: DashboardListItem) => () => {
    const {api, organization} = this.props;
    if (dashboard.type === 'org') {
      deleteDashboard(api, organization.slug, dashboard.id).then(() => {
        addSuccessMessage(t('Dashboard deleted'));

        browserHistory.replace({
          pathname: `/organizations/${organization.slug}/dashboards/`,
          query: {},
        });
      });
    }
  };

  onCommit = dashboard => () => {
    const {api, organization, location} = this.props;
    const {dashboardState, changesDashboard} = this.state;

    switch (dashboardState) {
      case 'create': {
        if (changesDashboard) {
          createDashboard(api, organization.slug, changesDashboard).then(
            (newDashboard: OrgDashboardResponse) => {
              addSuccessMessage(t('Dashboard created'));

              // redirect to new dashboard

              this.setState({
                dashboardState: 'default',
                changesDashboard: undefined,
              });

              browserHistory.replace({
                pathname: `/organizations/${organization.slug}/dashboards/${newDashboard.id}/`,
                query: {
                  ...location.query,
                },
              });
            }
          );
        }

        break;
      }
      case 'edit': {
        if (changesDashboard && changesDashboard.type === 'org') {
          // only update the dashboard if there are changes

          if (isEqual(dashboard, changesDashboard)) {
            this.setState({
              dashboardState: 'default',
              changesDashboard: undefined,
            });
            return;
          }

          updateDashboard(api, organization.slug, changesDashboard).then(() => {
            addSuccessMessage(t('Dashboard updated'));

            this.setState({
              dashboardState: 'default',
              changesDashboard: undefined,
            });

            this.reloadData();
          });

          return;
        }

        this.setState({
          dashboardState: 'default',
          changesDashboard: undefined,
        });
        break;
      }
      case 'default':
      default: {
        this.setState({
          dashboardState: 'default',
          changesDashboard: undefined,
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

  onWidgetChange = (widgets: Widget[]) => {
    const {changesDashboard} = this.state;
    if (changesDashboard === undefined) {
      return;
    }

    this.setState((prevState: State) => {
      return {
        ...prevState,
        changesDashboard: {
          ...changesDashboard,
          widgets,
        },
      };
    });
  };

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

  setChangesDashboard = (dashboard: DashboardListItem) => {
    this.setState({
      changesDashboard: dashboard,
    });
  };

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
              <Title
                changesDashboard={this.state.changesDashboard}
                setChangesDashboard={this.setChangesDashboard}
              />
              <Controls
                organization={organization}
                dashboards={this.getDashboardsList()}
                dashboard={dashboard}
                onEdit={this.onEdit(dashboard)}
                onCreate={this.onCreate}
                onCancel={this.onCancel}
                onCommit={this.onCommit(dashboard)}
                onDelete={this.onDelete(dashboard)}
                dashboardState={this.state.dashboardState}
              />
            </StyledPageHeader>
            {this.state.changesDashboard ? (
              <Dashboard
                dashboard={this.state.changesDashboard}
                organization={organization}
                isEditing={this.state.dashboardState === 'edit'}
                onUpdate={this.onWidgetChange}
              />
            ) : (
              <Dashboard
                dashboard={dashboard}
                organization={organization}
                isEditing={this.state.dashboardState === 'edit'}
                onUpdate={this.onWidgetChange}
              />
            )}
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
  white-space: nowrap;
`;

export default withOrganization(withApi(DashboardDetail));
