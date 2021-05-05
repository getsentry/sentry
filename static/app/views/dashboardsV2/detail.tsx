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
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
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
  reloadData?: () => void;
};

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
  widgetToBeUpdated?: Widget;
};

class DashboardDetail extends React.Component<Props> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
  };

  updateModifiedDashboard(dashboardState: DashboardState) {
    const {dashboard} = this.props;
    switch (dashboardState) {
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
        `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetId}/edit/` ||
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
        `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/` ||
      newWidget ||
      this.isWidgetBuilderEditRouter
    );
  }

  updateRouteAfterSavingWidget() {
    if (this.isWidgetBuilderRouter) {
      const {router, organization, params} = this.props;
      const {dashboardId} = params;
      if (dashboardId) {
        router.replace(`/organizations/${organization.slug}/dashboard/${dashboardId}/`);
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
    const {dashboard} = this.props;

    trackAnalyticsEvent({
      eventKey: 'dashboards2.edit.start',
      eventName: 'Dashboards2: Edit start',
      organization_id: parseInt(this.props.organization.id, 10),
    });

    this.setState({
      dashboardState: 'edit',
      modifiedDashboard: cloneDashboard(dashboard),
    });
  };

  onCommit = () => {
    const {api, organization, location, dashboard, reloadData} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;

    switch (dashboardState) {
      case 'create': {
        if (modifiedDashboard) {
          createDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));
              trackAnalyticsEvent({
                eventKey: 'dashboards2.create.complete',
                eventName: 'Dashboards2: Create complete',
                organization_id: parseInt(organization.id, 10),
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
              trackAnalyticsEvent({
                eventKey: 'dashboards2.edit.complete',
                eventName: 'Dashboards2: Edit complete',
                organization_id: parseInt(organization.id, 10),
              });
              this.setState({
                dashboardState: 'view',
                modifiedDashboard: null,
              });

              if (dashboard && newDashboard.id !== dashboard.id) {
                browserHistory.replace({
                  pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                  query: {
                    ...location.query,
                  },
                });
                return;
              }
              if (reloadData) {
                reloadData();
              }
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

  onCancel = () => {
    const {organization, location, params} = this.props;
    if (params.dashboardId) {
      trackAnalyticsEvent({
        eventKey: 'dashboards2.edit.cancel',
        eventName: 'Dashboards2: Edit cancel',
        organization_id: parseInt(this.props.organization.id, 10),
      });
      browserHistory.replace({
        pathname: `/organizations/${organization.slug}/dashboard/${params.dashboardId}/`,
        query: {
          ...location.query,
        },
      });
    } else {
      trackAnalyticsEvent({
        eventKey: 'dashboards2.create.cancel',
        eventName: 'Dashboards2: Create cancel',
        organization_id: parseInt(this.props.organization.id, 10),
      });
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
          trackAnalyticsEvent({
            eventKey: 'dashboards2.delete',
            eventName: 'Dashboards2: Delete',
            organization_id: parseInt(this.props.organization.id, 10),
          });
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
    trackAnalyticsEvent({
      eventKey: 'dashboards2.create.start',
      eventName: 'Dashboards2: Create start',
      organization_id: parseInt(this.props.organization.id, 10),
    });
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
    const {organization, dashboard, dashboards, params, router, location} = this.props;
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
                  dashboards={dashboards}
                  dashboard={dashboard}
                  onEdit={this.onEdit}
                  onCreate={this.onCreate}
                  onCancel={this.onCancel}
                  onCommit={this.onCommit}
                  onDelete={this.onDelete(dashboard)}
                  dashboardState={dashboardState}
                />
              </StyledPageHeader>
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

export default withApi(withOrganization(DashboardDetail));
