import React from 'react';
import {browserHistory, PlainRoute, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
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
import {DEFAULT_STATS_PERIOD, EMPTY_DASHBOARD} from './data';
import OrgDashboards from './orgDashboards';
import DashboardTitle from './title';
import {DashboardDetails, DashboardState, Widget} from './types';
import {cloneDashboard} from './utils';

const UNSAVED_MESSAGE = t('You have unsaved changes are you sure you want to leave?');

type Props = {
  api: Client;
  organization: Organization;
  route: PlainRoute;
} & WithRouterProps<{orgId: string; dashboardId: string}, {}>;

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
};

class DashboardDetail extends React.Component<Props, State> {
  state: State = {
    dashboardState: 'view',
    modifiedDashboard: null,
  };

  componentDidMount() {
    const {route, router} = this.props;
    router.setRouteLeaveHook(route, this.onRouteLeave);
    window.addEventListener('beforeunload', this.onUnload);
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  onEdit = (dashboard: State['modifiedDashboard']) => () => {
    if (!dashboard) {
      return;
    }
    this.setState({
      dashboardState: 'edit',
      modifiedDashboard: cloneDashboard(dashboard),
    });
  };

  onRouteLeave = (): string | undefined => {
    if (!['view', 'pending_delete'].includes(this.state.dashboardState)) {
      return UNSAVED_MESSAGE;
    }
    // eslint-disable-next-line consistent-return
    return;
  };

  onUnload = (event: BeforeUnloadEvent) => {
    if (['view', 'pending_delete'].includes(this.state.dashboardState)) {
      return;
    }
    event.preventDefault();
    event.returnValue = UNSAVED_MESSAGE;
  };

  onCreate = () => {
    this.setState({
      dashboardState: 'create',
      modifiedDashboard: cloneDashboard(EMPTY_DASHBOARD),
    });
  };

  onCancel = () => {
    this.setState({
      dashboardState: 'view',
      modifiedDashboard: null,
    });
  };

  onDelete = (dashboard: State['modifiedDashboard']) => () => {
    const {api, organization, location} = this.props;
    if (!dashboard?.id) {
      return;
    }

    const previousDashboardState = this.state.dashboardState;

    this.setState(
      {
        dashboardState: 'pending_delete',
      },
      () => {
        deleteDashboard(api, organization.slug, dashboard.id)
          .then(() => {
            addSuccessMessage(t('Dashboard deleted'));

            browserHistory.replace({
              pathname: `/organizations/${organization.slug}/dashboards/`,
              query: {
                ...location.query,
              },
            });
          })
          .catch(() => {
            this.setState({
              dashboardState: previousDashboardState,
            });
          });
      }
    );
  };

  onCommit = ({
    dashboard,
    reloadData,
  }: {
    dashboard: State['modifiedDashboard'];
    reloadData: () => void;
  }) => () => {
    const {api, organization, location} = this.props;
    const {dashboardState, modifiedDashboard} = this.state;

    switch (dashboardState) {
      case 'create': {
        if (modifiedDashboard) {
          createDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));

              this.setState({
                dashboardState: 'view',
                modifiedDashboard: null,
              });

              // redirect to new dashboard
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
        if (modifiedDashboard) {
          // only update the dashboard if there are changes
          if (isEqual(dashboard, modifiedDashboard)) {
            this.setState({
              dashboardState: 'view',
              modifiedDashboard: null,
            });
            return;
          }

          updateDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard updated'));

              this.setState({
                dashboardState: 'view',
                modifiedDashboard: null,
              });

              if (dashboard && newDashboard.id !== dashboard.id) {
                browserHistory.replace({
                  pathname: `/organizations/${organization.slug}/dashboards/${newDashboard.id}/`,
                  query: {
                    ...location.query,
                  },
                });
                return;
              }
              reloadData();
            }
          );

          return;
        }

        this.setState({
          dashboardState: 'view',
          modifiedDashboard: null,
        });
        break;
      }
      case 'view':
      default: {
        this.setState({
          dashboardState: 'view',
          modifiedDashboard: null,
        });
        break;
      }
    }
  };

  onWidgetChange = (widgets: Widget[]) => {
    const {modifiedDashboard} = this.state;
    if (modifiedDashboard === null) {
      return;
    }

    this.setState((prevState: State) => {
      return {
        ...prevState,
        modifiedDashboard: {
          ...modifiedDashboard,
          widgets,
        },
      };
    });
  };

  setModifiedDashboard = (dashboard: DashboardDetails) => {
    this.setState({
      modifiedDashboard: dashboard,
    });
  };

  render() {
    const {api, location, params, organization} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;

    const isEditing = ['edit', 'create', 'pending_delete'].includes(dashboardState);

    return (
      <GlobalSelectionHeader
        skipLoadLastUsed={organization.features.includes('global-views')}
        defaultSelection={{
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: DEFAULT_STATS_PERIOD,
          },
        }}
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
                  <DashboardTitle
                    dashboard={modifiedDashboard || dashboard}
                    onUpdate={this.setModifiedDashboard}
                    isEditing={isEditing}
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
                    dashboard={modifiedDashboard || dashboard}
                    organization={organization}
                    isEditing={isEditing}
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

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
  }
`;

export default withApi(withOrganization(DashboardDetail));
