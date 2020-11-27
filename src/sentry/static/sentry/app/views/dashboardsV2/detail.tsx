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
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Controls from './controls';
import Dashboard from './dashboard';
import {EMPTY_DASHBOARD} from './data';
import OrgDashboards from './orgDashboards';
import Title from './title';
import {DashboardListItem, DashboardState, OrgDashboardResponse, Widget} from './types';
import {cloneDashboard} from './utils';

type Props = {
  api: Client;
  location: Location;
  params: Params;
  organization: Organization;
};

type State = {
  dashboardState: DashboardState;
  changesDashboard: DashboardListItem | undefined;
};
class DashboardDetail extends React.Component<Props, State> {
  state: State = {
    dashboardState: 'view',
    changesDashboard: undefined,
  };

  static getDerivedStateFromProps(props: Props, state: State): State {
    if (state.changesDashboard && state.changesDashboard.type === 'org') {
      const {params} = props;
      const dashboardId = params.dashboardId as string | undefined;

      if (typeof dashboardId === 'string' && state.changesDashboard.id !== dashboardId) {
        return {
          ...state,
          dashboardState: 'view',
          changesDashboard: undefined,
        };
      }
    }

    return state;
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
      dashboardState: 'view',
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

  onCommit = ({
    dashboard,
    reloadData,
  }: {
    dashboard: DashboardListItem;
    reloadData: () => void;
  }) => () => {
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
                dashboardState: 'view',
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
              dashboardState: 'view',
              changesDashboard: undefined,
            });
            return;
          }

          updateDashboard(api, organization.slug, changesDashboard).then(() => {
            addSuccessMessage(t('Dashboard updated'));

            this.setState({
              dashboardState: 'view',
              changesDashboard: undefined,
            });

            reloadData();
          });

          return;
        }

        this.setState({
          dashboardState: 'view',
          changesDashboard: undefined,
        });
        break;
      }
      case 'view':
      default: {
        this.setState({
          dashboardState: 'view',
          changesDashboard: undefined,
        });
        break;
      }
    }
  };

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

  setChangesDashboard = (dashboard: DashboardListItem) => {
    this.setState({
      changesDashboard: dashboard,
    });
  };

  render() {
    const {api, location, params, organization} = this.props;

    return (
      <GlobalSelectionHeader
        skipLoadLastUsed={organization.features.includes('global-views')}
      >
        <OrgDashboards
          api={api}
          location={location}
          params={params}
          organization={organization}
        >
          {({dashboard, dashboards, reloadData}) => {
            return (
              <React.Fragment>
                <StyledPageHeader>
                  <Title
                    changesDashboard={this.state.changesDashboard}
                    setChangesDashboard={this.setChangesDashboard}
                  />
                  <Controls
                    organization={organization}
                    dashboards={dashboards}
                    dashboard={dashboard}
                    onEdit={this.onEdit(dashboard)}
                    onCreate={this.onCreate}
                    onCancel={this.onCancel}
                    onCommit={this.onCommit({dashboard, reloadData})}
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
              </React.Fragment>
            );
          }}
        </OrgDashboards>
      </GlobalSelectionHeader>
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
