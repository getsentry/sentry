import {cloneElement, Component, isValidElement} from 'react';
import type {Layout as RGLLayout} from 'react-grid-layout';
import {browserHistory, PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openDashboardWidgetLibraryModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import GlobalSelectionHeader from 'sentry/components/organizations/globalSelectionHeader';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import GridLayoutDashboard, {
  assignTempId,
  constructGridItemKey,
} from './gridLayout/dashboard';
import {getDashboardLayout, saveDashboardLayout} from './gridLayout/utils';
import Controls from './controls';
import DnDKitDashboard from './dashboard';
import {DEFAULT_STATS_PERIOD, EMPTY_DASHBOARD} from './data';
import DashboardTitle from './title';
import {DashboardDetails, DashboardListItem, DashboardState, Widget} from './types';
import {cloneDashboard} from './utils';

const UNSAVED_MESSAGE = t('You have unsaved changes, are you sure you want to leave?');

const HookHeader = HookOrDefault({hookName: 'component:dashboards-header'});

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
  onDashboardUpdate?: (updatedDashboard: DashboardDetails) => void;
  newWidget?: Widget;
};

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
  widgetToBeUpdated?: Widget;
  layout: RGLLayout[];
};

class DashboardDetail extends Component<Props, State> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
    layout: getDashboardLayout(this.props.organization.id, this.props.dashboard.id),
  };

  componentDidMount() {
    const {route, router} = this.props;
    this.checkStateRoute();
    router.setRouteLeaveHook(route, this.onRouteLeave);
    window.addEventListener('beforeunload', this.onUnload);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.location.pathname !== this.props.location.pathname) {
      this.checkStateRoute();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  checkStateRoute() {
    const {router, organization, params} = this.props;
    const {dashboardId} = params;

    const dashboardDetailsRoute = `/organizations/${organization.slug}/dashboard/${dashboardId}/`;

    if (this.isWidgetBuilderRouter && !this.isEditing) {
      router.replace(dashboardDetailsRoute);
    }

    if (location.pathname === dashboardDetailsRoute && !!this.state.widgetToBeUpdated) {
      this.onSetWidgetToBeUpdated(undefined);
    }
  }

  updateRouteAfterSavingWidget() {
    if (this.isWidgetBuilderRouter) {
      const {router, organization, params} = this.props;
      const {dashboardId} = params;
      if (dashboardId) {
        router.replace(`/organizations/${organization.slug}/dashboard/${dashboardId}/`);
        return;
      }
      router.replace(`/organizations/${organization.slug}/dashboards/new/`);
    }
  }

  updateModifiedDashboard(dashboardState: DashboardState) {
    const {dashboard} = this.props;
    switch (dashboardState) {
      case DashboardState.CREATE:
        return cloneDashboard(EMPTY_DASHBOARD);
      case DashboardState.EDIT:
        return cloneDashboard(dashboard);
      default: {
        return null;
      }
    }
  }

  get isEditing() {
    const {dashboardState} = this.state;
    return [
      DashboardState.EDIT,
      DashboardState.CREATE,
      DashboardState.PENDING_DELETE,
    ].includes(dashboardState);
  }

  get isWidgetBuilderRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId} = params;

    const newWidgetRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget/new/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`,
    ];

    return newWidgetRoutes.includes(location.pathname) || this.isWidgetBuilderEditRouter;
  }

  get isWidgetBuilderEditRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId, widgetId} = params;

    const widgetEditRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget/${widgetId}/edit/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetId}/edit/`,
    ];

    return widgetEditRoutes.includes(location.pathname);
  }

  get dashboardTitle() {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    return modifiedDashboard ? modifiedDashboard.title : dashboard.title;
  }

  onEdit = () => {
    const {dashboard} = this.props;

    trackAnalyticsEvent({
      eventKey: 'dashboards2.edit.start',
      eventName: 'Dashboards2: Edit start',
      organization_id: parseInt(this.props.organization.id, 10),
    });

    this.setState({
      dashboardState: DashboardState.EDIT,
      modifiedDashboard: cloneDashboard(dashboard),
    });
  };

  onRouteLeave = () => {
    if (
      ![DashboardState.VIEW, DashboardState.PENDING_DELETE].includes(
        this.state.dashboardState
      )
    ) {
      return UNSAVED_MESSAGE;
    }
    return undefined;
  };

  onUnload = (event: BeforeUnloadEvent) => {
    if (
      [DashboardState.VIEW, DashboardState.PENDING_DELETE].includes(
        this.state.dashboardState
      )
    ) {
      return;
    }
    event.preventDefault();
    event.returnValue = UNSAVED_MESSAGE;
  };

  onDelete = (dashboard: State['modifiedDashboard']) => () => {
    const {api, organization, location} = this.props;
    if (!dashboard?.id) {
      return;
    }

    const previousDashboardState = this.state.dashboardState;

    this.setState({dashboardState: DashboardState.PENDING_DELETE}, () => {
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
            query: location.query,
          });
        })
        .catch(() => {
          this.setState({
            dashboardState: previousDashboardState,
          });
        });
    });
  };

  onCancel = () => {
    const {organization, dashboard, location, params} = this.props;
    if (params.dashboardId) {
      trackAnalyticsEvent({
        eventKey: 'dashboards2.edit.cancel',
        eventName: 'Dashboards2: Edit cancel',
        organization_id: parseInt(this.props.organization.id, 10),
      });
      this.setState({
        dashboardState: DashboardState.VIEW,
        modifiedDashboard: null,
        layout: getDashboardLayout(organization.id, dashboard.id),
      });
      return;
    }
    trackAnalyticsEvent({
      eventKey: 'dashboards2.create.cancel',
      eventName: 'Dashboards2: Create cancel',
      organization_id: parseInt(this.props.organization.id, 10),
    });
    browserHistory.replace({
      pathname: `/organizations/${organization.slug}/dashboards/`,
      query: location.query,
    });
  };

  handleAddLibraryWidgets = (widgets: Widget[]) => {
    const {organization, dashboard, api, onDashboardUpdate, location} = this.props;
    const {dashboardState} = this.state;
    const modifiedDashboard = {
      ...cloneDashboard(dashboard),
      widgets: widgets.map(assignTempId),
    };
    this.setState({modifiedDashboard});
    if ([DashboardState.CREATE, DashboardState.EDIT].includes(dashboardState)) {
      return;
    }
    updateDashboard(api, organization.slug, modifiedDashboard).then(
      (newDashboard: DashboardDetails) => {
        if (onDashboardUpdate) {
          onDashboardUpdate(newDashboard);
        }
        addSuccessMessage(t('Dashboard updated'));
        if (dashboard && newDashboard.id !== dashboard.id) {
          browserHistory.replace({
            pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
            query: {
              ...location.query,
            },
          });
          return;
        }
      },
      () => undefined
    );
  };

  onAddWidget = () => {
    const {organization, dashboard} = this.props;
    this.setState({
      modifiedDashboard: cloneDashboard(dashboard),
    });
    openDashboardWidgetLibraryModal({
      organization,
      dashboard,
      onAddWidget: (widgets: Widget[]) => this.handleAddLibraryWidgets(widgets),
    });
  };

  /**
   * Saves a dashboard layout where the layout keys are replaced with the IDs of new widgets.
   */
  saveLayoutWithNewWidgets = (organizationId, dashboardId, newWidgets) => {
    const {layout} = this.state;
    if (layout.length !== newWidgets.length) {
      throw new Error('Expected layouts and widgets to be the same length');
    }

    const newLayout = layout.map((widgetLayout, index) => ({
      ...widgetLayout,
      i: constructGridItemKey(newWidgets[index]),
    }));
    saveDashboardLayout(organizationId, dashboardId, newLayout);
    this.setState({layout: newLayout, modifiedDashboard: null});
  };

  onCommit = () => {
    const {api, organization, location, dashboard, onDashboardUpdate} = this.props;
    const {layout, modifiedDashboard, dashboardState} = this.state;

    switch (dashboardState) {
      case DashboardState.CREATE: {
        if (modifiedDashboard) {
          createDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              if (organization.features.includes('dashboard-grid-layout')) {
                this.saveLayoutWithNewWidgets(
                  organization.id,
                  newDashboard.id,
                  newDashboard.widgets
                );
              }
              addSuccessMessage(t('Dashboard created'));
              trackAnalyticsEvent({
                eventKey: 'dashboards2.create.complete',
                eventName: 'Dashboards2: Create complete',
                organization_id: parseInt(organization.id, 10),
              });
              this.setState({
                dashboardState: DashboardState.VIEW,
                modifiedDashboard: null,
              });

              // redirect to new dashboard
              browserHistory.replace({
                pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                query: {
                  ...location.query,
                },
              });
            },
            () => undefined
          );
        }
        break;
      }
      case DashboardState.EDIT: {
        // TODO(nar): This should only fire when there are changes to the layout
        // and the dashboard can be successfully saved
        if (organization.features.includes('dashboard-grid-layout')) {
          saveDashboardLayout(organization.id, dashboard.id, layout);
        }

        // only update the dashboard if there are changes
        if (modifiedDashboard) {
          if (isEqual(dashboard, modifiedDashboard)) {
            this.setState({
              dashboardState: DashboardState.VIEW,
              modifiedDashboard: null,
            });
            return;
          }
          updateDashboard(api, organization.slug, modifiedDashboard).then(
            (newDashboard: DashboardDetails) => {
              if (onDashboardUpdate) {
                onDashboardUpdate(newDashboard);
              }

              if (organization.features.includes('dashboard-grid-layout')) {
                this.saveLayoutWithNewWidgets(
                  organization.id,
                  newDashboard.id,
                  newDashboard.widgets
                );
              }
              addSuccessMessage(t('Dashboard updated'));
              trackAnalyticsEvent({
                eventKey: 'dashboards2.edit.complete',
                eventName: 'Dashboards2: Edit complete',
                organization_id: parseInt(organization.id, 10),
              });
              this.setState({
                dashboardState: DashboardState.VIEW,
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
            },
            () => undefined
          );

          return;
        }
        this.setState({
          dashboardState: DashboardState.VIEW,
          modifiedDashboard: null,
        });
        break;
      }
      case DashboardState.VIEW:
      default: {
        this.setState({
          dashboardState: DashboardState.VIEW,
          modifiedDashboard: null,
        });
        break;
      }
    }
  };

  setModifiedDashboard = (dashboard: DashboardDetails) => {
    this.setState({
      modifiedDashboard: dashboard,
    });
  };

  onSetWidgetToBeUpdated = (widget?: Widget) => {
    this.setState({widgetToBeUpdated: widget});
  };

  onLayoutChange = (layout: RGLLayout[]) => {
    this.setState({layout});
  };

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

  renderWidgetBuilder(dashboard: DashboardDetails) {
    const {children} = this.props;
    const {modifiedDashboard, widgetToBeUpdated} = this.state;

    return isValidElement(children)
      ? cloneElement(children, {
          dashboard: modifiedDashboard ?? dashboard,
          onSave: this.onUpdateWidget,
          widget: widgetToBeUpdated,
        })
      : children;
  }

  renderDefaultDashboardDetail() {
    const {organization, dashboard, dashboards, params, router, location} = this.props;
    const {layout, modifiedDashboard, dashboardState} = this.state;
    const {dashboardId} = params;

    const dashboardProps = {
      paramDashboardId: dashboardId,
      dashboard: modifiedDashboard ?? dashboard,
      organization,
      isEditing: this.isEditing,
      onUpdate: this.onUpdateWidget,
      onSetWidgetToBeUpdated: this.onSetWidgetToBeUpdated,
      handleAddLibraryWidgets: this.handleAddLibraryWidgets,
      router,
      location,
    };

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
        <PageContent>
          <NoProjectMessage organization={organization}>
            <StyledPageHeader>
              <DashboardTitle
                dashboard={modifiedDashboard ?? dashboard}
                onUpdate={this.setModifiedDashboard}
                isEditing={this.isEditing}
              />
              <Controls
                organization={organization}
                dashboards={dashboards}
                onEdit={this.onEdit}
                onCancel={this.onCancel}
                onCommit={this.onCommit}
                onAddWidget={this.onAddWidget}
                onDelete={this.onDelete(dashboard)}
                dashboardState={dashboardState}
                widgetCount={dashboard.widgets.length}
              />
            </StyledPageHeader>
            <HookHeader organization={organization} />
            {organization.features.includes('dashboard-grid-layout') ? (
              <GridLayoutDashboard
                {...dashboardProps}
                layout={layout}
                onLayoutChange={this.onLayoutChange}
              />
            ) : (
              <DnDKitDashboard {...dashboardProps} />
            )}
          </NoProjectMessage>
        </PageContent>
      </GlobalSelectionHeader>
    );
  }

  renderDashboardDetail() {
    const {organization, dashboard, dashboards, params, router, location, newWidget} =
      this.props;
    const {layout, modifiedDashboard, dashboardState} = this.state;
    const {dashboardId} = params;

    const dashboardProps = {
      paramDashboardId: dashboardId,
      dashboard: modifiedDashboard ?? dashboard,
      organization,
      isEditing: this.isEditing,
      onUpdate: this.onUpdateWidget,
      handleAddLibraryWidgets: this.handleAddLibraryWidgets,
      onSetWidgetToBeUpdated: this.onSetWidgetToBeUpdated,
      router,
      location,
      newWidget,
    };

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
        <StyledPageContent>
          <NoProjectMessage organization={organization}>
            <Layout.Header>
              <Layout.HeaderContent>
                <Breadcrumbs
                  crumbs={[
                    {
                      label: t('Dashboards'),
                      to: `/organizations/${organization.slug}/dashboards/`,
                    },
                    {
                      label:
                        dashboardState === DashboardState.CREATE
                          ? t('Create Dashboard')
                          : organization.features.includes('dashboards-edit') &&
                            dashboard.id === 'default-overview'
                          ? 'Default Dashboard'
                          : this.dashboardTitle,
                    },
                  ]}
                />
                <Layout.Title>
                  <DashboardTitle
                    dashboard={modifiedDashboard ?? dashboard}
                    onUpdate={this.setModifiedDashboard}
                    isEditing={this.isEditing}
                  />
                </Layout.Title>
              </Layout.HeaderContent>
              <Layout.HeaderActions>
                <Controls
                  organization={organization}
                  dashboards={dashboards}
                  onEdit={this.onEdit}
                  onCancel={this.onCancel}
                  onCommit={this.onCommit}
                  onAddWidget={this.onAddWidget}
                  onDelete={this.onDelete(dashboard)}
                  dashboardState={dashboardState}
                  widgetCount={dashboard.widgets.length}
                />
              </Layout.HeaderActions>
            </Layout.Header>
            <Layout.Body>
              <Layout.Main fullWidth>
                {organization.features.includes('dashboard-grid-layout') ? (
                  <GridLayoutDashboard
                    {...dashboardProps}
                    layout={layout}
                    onLayoutChange={this.onLayoutChange}
                  />
                ) : (
                  <DnDKitDashboard {...dashboardProps} />
                )}
              </Layout.Main>
            </Layout.Body>
          </NoProjectMessage>
        </StyledPageContent>
      </GlobalSelectionHeader>
    );
  }

  render() {
    const {organization, dashboard} = this.props;

    if (this.isEditing && this.isWidgetBuilderRouter) {
      return this.renderWidgetBuilder(dashboard);
    }

    if (organization.features.includes('dashboards-edit')) {
      return this.renderDashboardDetail();
    }

    return this.renderDefaultDashboardDetail();
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

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export default withApi(withOrganization(DashboardDetail));
