import {cloneElement, Component, isValidElement} from 'react';
import {browserHistory, PlainRoute, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import Controls from './controls';
import Dashboard from './dashboard';
import {DEFAULT_STATS_PERIOD} from './data';
import {
  assignDefaultLayout,
  calculateColumnDepths,
  getDashboardLayout,
} from './layoutUtils';
import DashboardTitle from './title';
import {
  DashboardDetails,
  DashboardListItem,
  DashboardState,
  DashboardWidgetSource,
  MAX_WIDGETS,
  Widget,
} from './types';
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
  dashboard: DashboardDetails;
  dashboards: DashboardListItem[];
  initialState: DashboardState;
  organization: Organization;
  route: PlainRoute;
  newWidget?: Widget;
  onDashboardUpdate?: (updatedDashboard: DashboardDetails) => void;
};

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
  widgetLimitReached: boolean;
  widgetToBeUpdated?: Widget;
};

class DashboardDetail extends Component<Props, State> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
    widgetLimitReached: this.props.dashboard.widgets.length >= MAX_WIDGETS,
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
    const {organization, params} = this.props;
    const {dashboardId} = params;

    const dashboardDetailsRoute = `/organizations/${organization.slug}/dashboard/${dashboardId}/`;

    if (location.pathname === dashboardDetailsRoute && !!this.state.widgetToBeUpdated) {
      this.onSetWidgetToBeUpdated(undefined);
    }
  }

  updateModifiedDashboard(dashboardState: DashboardState) {
    const {dashboard} = this.props;
    switch (dashboardState) {
      case DashboardState.PREVIEW:
      case DashboardState.CREATE:
      case DashboardState.EDIT:
        return cloneDashboard(dashboard);
      default: {
        return null;
      }
    }
  }

  get isPreview() {
    const {dashboardState} = this.state;
    return DashboardState.PREVIEW === dashboardState;
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
    const {dashboardId, widgetId} = params;

    const widgetBuilderRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget/new/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`,
      `/organizations/${organization.slug}/dashboards/new/widget/${widgetId}/edit/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetId}/edit/`,
    ];

    return widgetBuilderRoutes.includes(location.pathname);
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
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;

    if (
      ![
        DashboardState.VIEW,
        DashboardState.PENDING_DELETE,
        DashboardState.PREVIEW,
      ].includes(this.state.dashboardState) &&
      !isEqual(modifiedDashboard, dashboard)
    ) {
      return UNSAVED_MESSAGE;
    }
    return undefined;
  };

  onUnload = (event: BeforeUnloadEvent) => {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;

    if (
      [
        DashboardState.VIEW,
        DashboardState.PENDING_DELETE,
        DashboardState.PREVIEW,
      ].includes(this.state.dashboardState) ||
      isEqual(modifiedDashboard, dashboard)
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
    const {modifiedDashboard} = this.state;

    let hasDashboardChanged = !isEqual(modifiedDashboard, dashboard);

    // If a dashboard has every layout undefined, then ignore the layout field
    // when checking equality because it is a dashboard from before the grid feature
    const isLegacyLayout = dashboard.widgets.every(({layout}) => !defined(layout));
    if (isLegacyLayout) {
      hasDashboardChanged = !isEqual(
        {
          ...modifiedDashboard,
          widgets: modifiedDashboard?.widgets.map(widget => omit(widget, 'layout')),
        },
        {...dashboard, widgets: dashboard.widgets.map(widget => omit(widget, 'layout'))}
      );
    }

    // Don't confirm preview cancellation regardless of dashboard state
    if (hasDashboardChanged && !this.isPreview) {
      // Ignore no-alert here, so that the confirm on cancel matches onUnload & onRouteLeave
      /* eslint no-alert:0 */
      if (!confirm(UNSAVED_MESSAGE)) {
        return;
      }
    }
    if (params.dashboardId) {
      trackAnalyticsEvent({
        eventKey: 'dashboards2.edit.cancel',
        eventName: 'Dashboards2: Edit cancel',
        organization_id: parseInt(this.props.organization.id, 10),
      });
      this.setState({
        dashboardState: DashboardState.VIEW,
        modifiedDashboard: null,
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

  handleUpdateWidgetList = (widgets: Widget[]) => {
    const {organization, dashboard, api, onDashboardUpdate, location} = this.props;
    const {modifiedDashboard} = this.state;

    // Use the new widgets for calculating layout because widgets has
    // the most up to date information in edit state
    const currentLayout = getDashboardLayout(widgets);
    const layoutColumnDepths = calculateColumnDepths(currentLayout);
    const newModifiedDashboard = {
      ...cloneDashboard(modifiedDashboard || dashboard),
      widgets: assignDefaultLayout(widgets, layoutColumnDepths),
    };
    this.setState({
      modifiedDashboard: newModifiedDashboard,
      widgetLimitReached: widgets.length >= MAX_WIDGETS,
    });
    if (this.isEditing || this.isPreview) {
      return;
    }
    updateDashboard(api, organization.slug, newModifiedDashboard).then(
      (newDashboard: DashboardDetails) => {
        if (onDashboardUpdate) {
          onDashboardUpdate(newDashboard);
          this.setState({
            modifiedDashboard: null,
          });
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

  handleAddCustomWidget = (widget: Widget) => {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    const newModifiedDashboard = modifiedDashboard || dashboard;
    this.onUpdateWidget([...newModifiedDashboard.widgets, widget]);
  };

  onAddWidget = () => {
    const {organization, dashboard} = this.props;
    this.setState({
      modifiedDashboard: cloneDashboard(dashboard),
    });

    openAddDashboardWidgetModal({
      organization,
      dashboard,
      onAddLibraryWidget: (widgets: Widget[]) => this.handleUpdateWidgetList(widgets),
      source: DashboardWidgetSource.LIBRARY,
    });
  };

  onCommit = () => {
    const {api, organization, location, dashboard, onDashboardUpdate} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;

    switch (dashboardState) {
      case DashboardState.PREVIEW:
      case DashboardState.CREATE: {
        if (modifiedDashboard) {
          if (this.isPreview) {
            trackAdvancedAnalyticsEvent('dashboards_manage.templates.add', {
              organization,
              dashboard_id: dashboard.id,
              dashboard_title: dashboard.title,
              was_previewed: true,
            });
          }
          createDashboard(api, organization.slug, modifiedDashboard, this.isPreview).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));
              trackAnalyticsEvent({
                eventKey: 'dashboards2.create.complete',
                eventName: 'Dashboards2: Create complete',
                organization_id: parseInt(organization.id, 10),
              });
              this.setState({
                dashboardState: DashboardState.VIEW,
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

  onUpdateWidget = (widgets: Widget[]) => {
    this.setState((state: State) => ({
      ...state,
      widgetToBeUpdated: undefined,
      widgetLimitReached: widgets.length >= MAX_WIDGETS,
      modifiedDashboard: {
        ...(state.modifiedDashboard || this.props.dashboard),
        widgets,
      },
    }));
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
    const {modifiedDashboard, dashboardState, widgetLimitReached} = this.state;
    const {dashboardId} = params;

    return (
      <PageFiltersContainer
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
                widgetLimitReached={widgetLimitReached}
              />
            </StyledPageHeader>
            <HookHeader organization={organization} />
            <Dashboard
              paramDashboardId={dashboardId}
              dashboard={modifiedDashboard ?? dashboard}
              organization={organization}
              isEditing={this.isEditing}
              widgetLimitReached={widgetLimitReached}
              onUpdate={this.onUpdateWidget}
              onSetWidgetToBeUpdated={this.onSetWidgetToBeUpdated}
              handleUpdateWidgetList={this.handleUpdateWidgetList}
              handleAddCustomWidget={this.handleAddCustomWidget}
              isPreview={this.isPreview}
              router={router}
              location={location}
            />
          </NoProjectMessage>
        </PageContent>
      </PageFiltersContainer>
    );
  }

  getBreadcrumbLabel() {
    const {dashboardState} = this.state;

    let label = this.dashboardTitle;
    if (dashboardState === DashboardState.CREATE) {
      label = t('Create Dashboard');
    } else if (this.isPreview) {
      label = t('Preview Dashboard');
    }
    return label;
  }

  renderDashboardDetail() {
    const {organization, dashboard, dashboards, params, router, location, newWidget} =
      this.props;
    const {modifiedDashboard, dashboardState, widgetLimitReached} = this.state;
    const {dashboardId} = params;

    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={organization.slug}>
        <PageFiltersContainer
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
                        label: this.getBreadcrumbLabel(),
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
                    widgetLimitReached={widgetLimitReached}
                  />
                </Layout.HeaderActions>
              </Layout.Header>
              <Layout.Body>
                <Layout.Main fullWidth>
                  <Dashboard
                    paramDashboardId={dashboardId}
                    dashboard={modifiedDashboard ?? dashboard}
                    organization={organization}
                    isEditing={this.isEditing}
                    widgetLimitReached={widgetLimitReached}
                    onUpdate={this.onUpdateWidget}
                    handleUpdateWidgetList={this.handleUpdateWidgetList}
                    handleAddCustomWidget={this.handleAddCustomWidget}
                    onSetWidgetToBeUpdated={this.onSetWidgetToBeUpdated}
                    router={router}
                    location={location}
                    newWidget={newWidget}
                    isPreview={this.isPreview}
                  />
                </Layout.Main>
              </Layout.Body>
            </NoProjectMessage>
          </StyledPageContent>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    );
  }

  render() {
    const {organization, dashboard} = this.props;

    if (this.isWidgetBuilderRouter) {
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
