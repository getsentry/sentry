import React from 'react';
import {browserHistory, PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from 'app/actionCreators/dashboards';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import NotFound from 'app/components/errors/notFound';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Controls from './controls';
import Dashboard from './dashboard';
import {DEFAULT_STATS_PERIOD, EMPTY_DASHBOARD} from './data';
import DashboardTitle from './title';
import {DashboardDetails, DashboardListItem, DashboardState, Widget} from './types';
import {cloneDashboard} from './utils';

type RouteParams = {
  orgId: string;
  dashboardId?: string;
  widgetId?: number;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  api: Client;
  organization: Organization;
  initialState: DashboardState;
  dashboard: DashboardDetails;
  dashboards: DashboardListItem[];
  route: PlainRoute;
  error?: boolean;
};

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
  widgetToBeUpdated?: Widget;
};

class DashboardsContainer extends React.Component<Props> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.initialModifiedDashboard(),
  };

  initialModifiedDashboard() {
    const {initialState, dashboard} = this.props;
    switch (initialState) {
      case 'create':
        return cloneDashboard(EMPTY_DASHBOARD);
      case 'edit':
        return cloneDashboard(dashboard);
      default: {
        return null;
      }
    }
  }

  get isEditing() {
    const {dashboardState} = this.state;
    return ['edit', 'create', 'pending_delete'].includes(dashboardState);
  }

  get isWidgetBuilderEditRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId, widgetId} = params;

    const isNewDashboardEditRouter =
      location.pathname ===
      `/organizations/${organization.slug}/dashboards/new/widget/${widgetId}/edit/`;
    return (
      location.pathname ===
        `/organizations/${organization.slug}/dashboard/${dashboardId}/edit/widget/${widgetId}/edit/` ||
      isNewDashboardEditRouter
    );
  }

  get isWidgetBuilderRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId} = params;

    const newWidget =
      location.pathname ===
      `/organizations/${organization.slug}/dashboards/new/widget/new/`;

    return (
      location.pathname ===
        `/organizations/${organization.slug}/dashboard/${dashboardId}/edit/widget/new/` ||
      newWidget ||
      this.isWidgetBuilderEditRouter
    );
  }

  updateRouteAfterSavingWidget() {
    if (this.isWidgetBuilderRouter) {
      const {router, organization, params} = this.props;
      const {dashboardId} = params;
      if (dashboardId) {
        router.replace(
          `/organizations/${organization.slug}/dashboard/${dashboardId}/edit/`
        );
      } else {
        router.replace(`/organizations/${organization.slug}/dashboards/new/`);
      }
    }
  }

  onUpdateWidget = (widgets: Widget[]) => {
    const {modifiedDashboard} = this.state;

    if (modifiedDashboard === null) {
      return;
    }
    this.setState(
      (state: State) => ({
        ...state,
        widgetToBeUpdated: undefined,
        modifiedDashboard: {
          ...state.modifiedDashboard!,
          widgets,
        },
      }),
      this.updateRouteAfterSavingWidget
    );
  };

  onSetWidgetToBeUpdated = (widget?: Widget) => {
    this.setState({widgetToBeUpdated: widget});
  };

  setModifiedDashboard = (dashboard: DashboardDetails) => {
    this.setState({
      modifiedDashboard: dashboard,
    });
  };

  onEdit = () => {
    const {dashboard, organization, location} = this.props;

    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/edit/`,
      query: {
        ...location.query,
      },
    });
  };

  onCommit = () => {
    const {api, organization, location, dashboard} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;

    switch (dashboardState) {
      case 'create': {
        if (modifiedDashboard) {
          createDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));
              this.setState({
                dashboardState: 'view',
              });

              // redirect to new dashboard
              browserHistory.replace({
                pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
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
        // only update the dashboard if there are changes
        if (modifiedDashboard) {
          if (!isEqual(dashboard, modifiedDashboard)) {
            updateDashboard(api, organization.slug, modifiedDashboard).then(
              (newDashboard: DashboardDetails) => {
                addSuccessMessage(t('Dashboard updated'));
                browserHistory.replace({
                  pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                  query: {
                    ...location.query,
                  },
                });
                return;
              }
            );
            browserHistory.replace({
              pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
              query: {
                ...location.query,
              },
            });
            return;
          }
        }
        browserHistory.replace({
          pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
          query: {
            ...location.query,
          },
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

  onCancel = () => {
    const {organization, location, params} = this.props;
    if (params.dashboardId) {
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboard/${params.dashboardId}/`,
        query: {
          ...location.query,
        },
      });
    } else {
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: {
          ...location.query,
        },
      });
    }
  };

  onDelete = (dashboard: State['modifiedDashboard']) => () => {
    const {api, organization, location} = this.props;
    if (!dashboard?.id) {
      return;
    }

    const previousDashboardState = this.state.dashboardState;

    this.setState({dashboardState: 'pending_delete'}, () => {
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
    });
  };

  onCreate = () => {
    const {organization, location} = this.props;
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/dashboards/new/`,
      query: {
        ...location.query,
      },
    });
  };

  renderWidgetBuilder(dashboard: DashboardDetails) {
    const {children} = this.props;
    const {modifiedDashboard, widgetToBeUpdated} = this.state;

    return React.isValidElement(children)
      ? React.cloneElement(children, {
          dashboard: modifiedDashboard || dashboard,
          onSave: this.onUpdateWidget,
          widget: widgetToBeUpdated,
        })
      : children;
  }

  render() {
    const {organization, dashboard, params, router, location, error} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;
    const {dashboardId} = params;

    if (this.isEditing && this.isWidgetBuilderRouter) {
      return this.renderWidgetBuilder(dashboard);
    }

    return (
      <Feature features={['dashboards-basic']} organization={organization}>
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
          <PageContent>
            <LightWeightNoProjectMessage organization={organization}>
              <StyledPageHeader>
                <DashboardTitle
                  dashboard={modifiedDashboard || dashboard}
                  onUpdate={this.setModifiedDashboard}
                  isEditing={this.isEditing}
                />
                <Controls
                  organization={organization}
                  dashboards={[]}
                  dashboard={dashboard}
                  onEdit={this.onEdit}
                  onCreate={this.onCreate}
                  onCancel={this.onCancel}
                  onCommit={this.onCommit}
                  onDelete={this.onDelete(dashboard)}
                  dashboardState={dashboardState}
                />
              </StyledPageHeader>
              {error ? (
                <NotFound />
              ) : dashboard ? (
                <Dashboard
                  paramDashboardId={dashboardId}
                  dashboard={modifiedDashboard || dashboard}
                  organization={organization}
                  isEditing={this.isEditing}
                  onUpdate={this.onUpdateWidget}
                  onSetWidgetToBeUpdated={this.onSetWidgetToBeUpdated}
                  router={router}
                  location={location}
                />
              ) : (
                <LoadingIndicator />
              )}
            </LightWeightNoProjectMessage>
          </PageContent>
        </GlobalSelectionHeader>
      </Feature>
    );
  }
}

const StyledPageHeader = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-row-gap: ${space(2)};
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: minmax(0, 1fr) max-content;
    grid-column-gap: ${space(2)};
    height: 40px;
  }
`;

export default withApi(withOrganization(DashboardsContainer));
