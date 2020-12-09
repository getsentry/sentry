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
import NotFound from 'app/components/errors/notFound';
import LoadingIndicator from 'app/components/loadingIndicator';
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
import {DashboardDetails, DashboardState, Widget} from './types';
import {cloneDashboard} from './utils';

type Props = {
  api: Client;
  location: Location;
  params: Params;
  organization: Organization;
};

type State = {
  dashboardState: DashboardState;
  changesDashboard: DashboardDetails | null;
};

class DashboardDetail extends React.Component<Props, State> {
  state: State = {
    dashboardState: 'view',
    changesDashboard: null,
  };

  onEdit = (dashboard: State['changesDashboard']) => () => {
    if (!dashboard) {
      return;
    }
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
      changesDashboard: null,
    });
  };

  onDelete = (dashboard: State['changesDashboard']) => () => {
    const {api, organization} = this.props;
    if (!dashboard?.id) {
      return;
    }

    deleteDashboard(api, organization.slug, dashboard.id).then(() => {
      addSuccessMessage(t('Dashboard deleted'));

      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: {},
      });
    });
  };

  onCommit = ({
    dashboard,
    reloadData,
  }: {
    dashboard: State['changesDashboard'];
    reloadData: () => void;
  }) => () => {
    const {api, organization, location} = this.props;
    const {dashboardState, changesDashboard} = this.state;

    switch (dashboardState) {
      case 'create': {
        if (changesDashboard) {
          createDashboard(api, organization.slug, changesDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));

              // redirect to new dashboard

              this.setState({
                dashboardState: 'view',
                changesDashboard: null,
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
        if (changesDashboard) {
          // only update the dashboard if there are changes

          if (isEqual(dashboard, changesDashboard)) {
            this.setState({
              dashboardState: 'view',
              changesDashboard: null,
            });
            return;
          }

          updateDashboard(api, organization.slug, changesDashboard).then(() => {
            addSuccessMessage(t('Dashboard updated'));

            this.setState({
              dashboardState: 'view',
              changesDashboard: null,
            });

            reloadData();
          });

          return;
        }

        this.setState({
          dashboardState: 'view',
          changesDashboard: null,
        });
        break;
      }
      case 'view':
      default: {
        this.setState({
          dashboardState: 'view',
          changesDashboard: null,
        });
        break;
      }
    }
  };

  onWidgetChange = (widgets: Widget[]) => {
    const {changesDashboard} = this.state;
    if (changesDashboard === null) {
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

  setChangesDashboard = (dashboard: DashboardDetails) => {
    this.setState({
      changesDashboard: dashboard,
    });
  };

  render() {
    const {api, location, params, organization} = this.props;
    const {changesDashboard, dashboardState} = this.state;

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
          {({dashboard, dashboards, error, reloadData}) => {
            return (
              <React.Fragment>
                <StyledPageHeader>
                  <Title
                    changesDashboard={changesDashboard}
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
                    dashboardState={dashboardState}
                  />
                </StyledPageHeader>
                {error ? (
                  <NotFound />
                ) : dashboard ? (
                  <Dashboard
                    dashboard={changesDashboard || dashboard}
                    organization={organization}
                    isEditing={dashboardState === 'edit' || dashboardState === 'create'}
                    onUpdate={this.onWidgetChange}
                  />
                ) : (
                  <LoadingIndicator />
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
