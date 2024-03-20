import {cloneElement, Component, isValidElement} from 'react';
import type {PlainRoute, RouteComponentProps} from 'react-router';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import isEqualWith from 'lodash/isEqualWith';
import omit from 'lodash/omit';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openWidgetViewerModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import {
  isWidgetViewerPath,
  WidgetViewerQueryField,
} from 'sentry/components/modals/widgetViewerModal/utils';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, PageFilters, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MetricsResultsMetaProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OnDemandControlProvider} from 'sentry/utils/performance/contexts/onDemandControl';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import {defaultMetricWidget} from 'sentry/views/dashboards/metrics/utils';
import {
  cloneDashboard,
  getCurrentPageFilters,
  getDashboardFiltersFromURL,
  hasUnsavedFilterChanges,
  isWidgetUsingTransactionName,
  openWidgetPreviewModal,
  resetPageFilters,
} from 'sentry/views/dashboards/utils';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';
import {MetricsDashboardContextProvider} from 'sentry/views/dashboards/widgetCard/metricsContext';
import {MetricsDataSwitcherAlert} from 'sentry/views/performance/landing/metricsDataSwitcherAlert';

import {generatePerformanceEventView} from '../performance/data';
import {MetricsDataSwitcher} from '../performance/landing/metricsDataSwitcher';
import {DiscoverQueryPageSource} from '../performance/utils';

import type {WidgetViewerContextProps} from './widgetViewer/widgetViewerContext';
import {WidgetViewerContext} from './widgetViewer/widgetViewerContext';
import Controls from './controls';
import Dashboard from './dashboard';
import {DEFAULT_STATS_PERIOD} from './data';
import FiltersBar from './filtersBar';
import {
  assignDefaultLayout,
  assignTempId,
  calculateColumnDepths,
  generateWidgetsAfterCompaction,
  getDashboardLayout,
} from './layoutUtils';
import DashboardTitle from './title';
import type {
  DashboardDetails,
  DashboardFilters,
  DashboardListItem,
  Widget,
} from './types';
import {
  DashboardFilterKeys,
  DashboardState,
  DashboardWidgetSource,
  MAX_WIDGETS,
  WidgetType,
} from './types';

const UNSAVED_MESSAGE = t('You have unsaved changes, are you sure you want to leave?');

export const UNSAVED_FILTERS_MESSAGE = t(
  'You have unsaved dashboard filters. You can save or discard them.'
);

const HookHeader = HookOrDefault({hookName: 'component:dashboards-header'});

type RouteParams = {
  dashboardId?: string;
  templateId?: string;
  widgetId?: number | string;
  widgetIndex?: number;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  api: Client;
  dashboard: DashboardDetails;
  dashboards: DashboardListItem[];
  initialState: DashboardState;
  organization: Organization;
  projects: Project[];
  route: PlainRoute;
  selection: PageFilters;
  children?: React.ReactNode;
  newWidget?: Widget;
  onDashboardUpdate?: (updatedDashboard: DashboardDetails) => void;
  onSetNewWidget?: () => void;
};

type State = {
  dashboardState: DashboardState;
  modifiedDashboard: DashboardDetails | null;
  widgetLimitReached: boolean;
} & WidgetViewerContextProps;

class DashboardDetail extends Component<Props, State> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
    widgetLimitReached: this.props.dashboard.widgets.length >= MAX_WIDGETS,
    setData: data => {
      this.setState(data);
    },
  };

  componentDidMount() {
    const {route, router} = this.props;
    router.setRouteLeaveHook(route, this.onRouteLeave);
    window.addEventListener('beforeunload', this.onUnload);
    this.checkIfShouldMountWidgetViewerModal();
  }

  componentDidUpdate(prevProps: Props) {
    this.checkIfShouldMountWidgetViewerModal();

    if (prevProps.initialState !== this.props.initialState) {
      // Widget builder can toggle Edit state when saving
      this.setState({dashboardState: this.props.initialState});
    }
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.onUnload);
  }

  checkIfShouldMountWidgetViewerModal() {
    const {
      params: {widgetId, dashboardId},
      organization,
      dashboard,
      location,
      router,
    } = this.props;
    const {seriesData, tableData, pageLinks, totalIssuesCount, seriesResultsType} =
      this.state;
    if (isWidgetViewerPath(location.pathname)) {
      const widget =
        defined(widgetId) &&
        (dashboard.widgets.find(({id}) => {
          // This ternary exists because widgetId is in some places typed as string, while
          // in other cases it is typed as number. Instead of changing the type everywhere,
          // we check for both cases at runtime as I am not sure which is the correct type.
          return typeof widgetId === 'number' ? id === String(widgetId) : id === widgetId;
        }) ??
          dashboard.widgets[widgetId]);
      if (widget) {
        openWidgetViewerModal({
          organization,
          widget,
          seriesData,
          seriesResultsType,
          tableData,
          pageLinks,
          totalIssuesCount,
          dashboardFilters: getDashboardFiltersFromURL(location) ?? dashboard.filters,
          onMetricWidgetEdit: (updatedWidget: Widget) => {
            const widgets = [...dashboard.widgets];

            const widgetIndex = dashboard.widgets.indexOf(widget);
            widgets[widgetIndex] = {...widgets[widgetIndex], ...updatedWidget};

            this.handleUpdateWidgetList(widgets);
          },
          onClose: () => {
            // Filter out Widget Viewer Modal query params when exiting the Modal
            const query = omit(location.query, Object.values(WidgetViewerQueryField));
            router.push({
              pathname: location.pathname.replace(/widget\/[0-9]+\/$/, ''),
              query,
            });
          },
          onEdit: () => {
            const widgetIndex = dashboard.widgets.indexOf(widget);
            if (dashboardId) {
              router.push(
                normalizeUrl({
                  pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetIndex}/edit/`,
                  query: {
                    ...location.query,
                    source: DashboardWidgetSource.DASHBOARDS,
                  },
                })
              );
              return;
            }
          },
        });
        trackAnalytics('dashboards_views.widget_viewer.open', {
          organization,
          widget_type: widget.widgetType ?? WidgetType.DISCOVER,
          display_type: widget.displayType,
        });
      } else {
        // Replace the URL if the widget isn't found and raise an error in toast
        router.replace(
          normalizeUrl({
            pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
            query: location.query,
          })
        );
        addErrorMessage(t('Widget not found'));
      }
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

  get isEditingDashboard() {
    const {dashboardState} = this.state;
    return [
      DashboardState.EDIT,
      DashboardState.CREATE,
      DashboardState.PENDING_DELETE,
    ].includes(dashboardState);
  }

  get isWidgetBuilderRouter() {
    const {location, params, organization} = this.props;
    const {dashboardId, widgetIndex} = params;

    const widgetBuilderRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget/new/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`,
      `/organizations/${organization.slug}/dashboards/new/widget/${widgetIndex}/edit/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/${widgetIndex}/edit/`,
    ];

    if (USING_CUSTOMER_DOMAIN) {
      // TODO: replace with url generation later on.
      widgetBuilderRoutes.push(
        ...[
          `/dashboards/new/widget/new/`,
          `/dashboard/${dashboardId}/widget/new/`,
          `/dashboards/new/widget/${widgetIndex}/edit/`,
          `/dashboard/${dashboardId}/widget/${widgetIndex}/edit/`,
        ]
      );
    }

    return widgetBuilderRoutes.includes(location.pathname);
  }

  get dashboardTitle() {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    return modifiedDashboard ? modifiedDashboard.title : dashboard.title;
  }

  onEdit = () => {
    const {dashboard, organization} = this.props;
    trackAnalytics('dashboards2.edit.start', {organization});

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
          trackAnalytics('dashboards2.delete', {organization});
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
      trackAnalytics('dashboards2.edit.cancel', {organization});
      this.setState({
        dashboardState: DashboardState.VIEW,
        modifiedDashboard: null,
      });
      return;
    }
    trackAnalytics('dashboards2.create.cancel', {organization});
    browserHistory.replace(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/`,
        query: location.query,
      })
    );
  };

  handleChangeFilter = (activeFilters: DashboardFilters) => {
    const {dashboard, location} = this.props;
    const {modifiedDashboard} = this.state;
    const newModifiedDashboard = modifiedDashboard || dashboard;

    if (
      Object.keys(activeFilters).every(
        key => !newModifiedDashboard.filters?.[key] && activeFilters[key].length === 0
      )
    ) {
      return;
    }

    const filterParams: DashboardFilters = {};
    Object.keys(activeFilters).forEach(key => {
      filterParams[key] = activeFilters[key].length ? activeFilters[key] : '';
    });

    if (
      !isEqualWith(activeFilters, dashboard.filters, (a, b) => {
        // This is to handle the case where dashboard filters has release:[] and the new filter is release:""
        if (a.length === 0 && b.length === 0) {
          return a === b;
        }
        return undefined;
      })
    ) {
      browserHistory.push({
        ...location,
        query: {
          ...location.query,
          ...filterParams,
        },
      });
    }
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
    if (this.isEditingDashboard || this.isPreview) {
      return null;
    }
    return updateDashboard(api, organization.slug, newModifiedDashboard).then(
      (newDashboard: DashboardDetails) => {
        if (onDashboardUpdate) {
          onDashboardUpdate(newDashboard);
          this.setState({
            modifiedDashboard: null,
          });
        }
        addSuccessMessage(t('Dashboard updated'));
        if (dashboard && newDashboard.id !== dashboard.id) {
          browserHistory.replace(
            normalizeUrl({
              pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
              query: {
                ...location.query,
              },
            })
          );
        }
        return newDashboard;
      },
      // `updateDashboard` does its own error handling
      () => undefined
    );
  };

  handleAddCustomWidget = (widget: Widget) => {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    const newModifiedDashboard = modifiedDashboard || dashboard;
    this.onUpdateWidget([...newModifiedDashboard.widgets, widget]);
  };

  handleAddMetricWidget = (layout?: Widget['layout']) => {
    const {dashboard, router, location} = this.props;

    const widgetCopy = cloneDeep(
      assignTempId({
        layout,
        ...defaultMetricWidget(),
      })
    );

    const nextList = generateWidgetsAfterCompaction([...dashboard.widgets, widgetCopy]);

    this.onUpdateWidget(nextList);
    if (!this.isEditingDashboard) {
      this.handleUpdateWidgetList(nextList)?.then((newDashboard?: DashboardDetails) => {
        if (!newDashboard) {
          return;
        }

        const lastWidget = newDashboard?.widgets[newDashboard.widgets.length - 1];
        openWidgetPreviewModal(router, location, lastWidget);
      });
    }
  };

  onAddWidget = (dataset: DataSet) => {
    const {
      organization,
      dashboard,
      router,
      location,
      params: {dashboardId},
    } = this.props;

    if (dataset === DataSet.METRICS) {
      this.handleAddMetricWidget();
      return;
    }
    this.setState(
      {
        modifiedDashboard: cloneDashboard(dashboard),
      },
      () => {
        if (dashboardId) {
          router.push(
            normalizeUrl({
              pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/widget/new/`,
              query: {
                ...location.query,
                source: DashboardWidgetSource.DASHBOARDS,
                dataset,
              },
            })
          );
        }
      }
    );
  };

  onCommit = () => {
    const {api, organization, location, dashboard, onDashboardUpdate} = this.props;
    const {modifiedDashboard, dashboardState} = this.state;

    switch (dashboardState) {
      case DashboardState.PREVIEW:
      case DashboardState.CREATE: {
        if (modifiedDashboard) {
          if (this.isPreview) {
            trackAnalytics('dashboards_manage.templates.add', {
              organization,
              dashboard_id: dashboard.id,
              dashboard_title: dashboard.title,
              was_previewed: true,
            });
          }
          const newModifiedDashboard = {
            ...cloneDashboard(modifiedDashboard),
            ...getCurrentPageFilters(location),
            filters: getDashboardFiltersFromURL(location) ?? modifiedDashboard.filters,
          };
          createDashboard(
            api,
            organization.slug,
            newModifiedDashboard,
            this.isPreview
          ).then(
            (newDashboard: DashboardDetails) => {
              addSuccessMessage(t('Dashboard created'));
              trackAnalytics('dashboards2.create.complete', {organization});
              this.setState(
                {
                  dashboardState: DashboardState.VIEW,
                },
                () => {
                  // redirect to new dashboard
                  browserHistory.replace(
                    normalizeUrl({
                      pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                      query: {
                        query: omit(location.query, Object.values(DashboardFilterKeys)),
                      },
                    })
                  );
                }
              );
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
              trackAnalytics('dashboards2.edit.complete', {organization});
              this.setState(
                {
                  dashboardState: DashboardState.VIEW,
                  modifiedDashboard: null,
                },
                () => {
                  if (dashboard && newDashboard.id !== dashboard.id) {
                    browserHistory.replace(
                      normalizeUrl({
                        pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                        query: {
                          ...location.query,
                        },
                      })
                    );
                  }
                }
              );
            },
            // `updateDashboard` does its own error handling
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

  onUpdateWidget = (widgets: Widget[]) => {
    this.setState((state: State) => ({
      ...state,
      widgetLimitReached: widgets.length >= MAX_WIDGETS,
      modifiedDashboard: {
        ...(state.modifiedDashboard || this.props.dashboard),
        widgets,
      },
    }));
  };

  renderWidgetBuilder() {
    const {children, dashboard} = this.props;
    const {modifiedDashboard} = this.state;

    return isValidElement(children)
      ? cloneElement<any>(children, {
          dashboard: modifiedDashboard ?? dashboard,
          onSave: this.isEditingDashboard
            ? this.onUpdateWidget
            : this.handleUpdateWidgetList,
        })
      : children;
  }

  renderDefaultDashboardDetail() {
    const {organization, dashboard, dashboards, params, router, location} = this.props;
    const {modifiedDashboard, dashboardState, widgetLimitReached} = this.state;
    const {dashboardId} = params;

    return (
      <PageFiltersContainer
        disablePersistence
        defaultSelection={{
          datetime: {
            start: null,
            end: null,
            utc: false,
            period: DEFAULT_STATS_PERIOD,
          },
        }}
      >
        <Layout.Page withPadding>
          <OnDemandControlProvider location={location}>
            <MetricsDashboardContextProvider>
              <MetricsResultsMetaProvider>
                <NoProjectMessage organization={organization}>
                  <StyledPageHeader>
                    <Layout.Title>
                      <DashboardTitle
                        dashboard={modifiedDashboard ?? dashboard}
                        onUpdate={this.setModifiedDashboard}
                        isEditingDashboard={this.isEditingDashboard}
                      />
                    </Layout.Title>
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
                  <FiltersBar
                    filters={{}} // Default Dashboards don't have filters set
                    location={location}
                    hasUnsavedChanges={false}
                    isEditingDashboard={false}
                    isPreview={false}
                    onDashboardFilterChange={this.handleChangeFilter}
                  />
                  <MetricsCardinalityProvider
                    organization={organization}
                    location={location}
                  >
                    <MetricsDataSwitcher
                      organization={organization}
                      eventView={EventView.fromLocation(location)}
                      location={location}
                    >
                      {metricsDataSide => (
                        <MEPSettingProvider
                          location={location}
                          forceTransactions={metricsDataSide.forceTransactionsOnly}
                        >
                          <Dashboard
                            paramDashboardId={dashboardId}
                            dashboard={modifiedDashboard ?? dashboard}
                            organization={organization}
                            isEditingDashboard={this.isEditingDashboard}
                            widgetLimitReached={widgetLimitReached}
                            onUpdate={this.onUpdateWidget}
                            handleUpdateWidgetList={this.handleUpdateWidgetList}
                            handleAddCustomWidget={this.handleAddCustomWidget}
                            handleAddMetricWidget={this.handleAddMetricWidget}
                            isPreview={this.isPreview}
                            router={router}
                            location={location}
                          />
                        </MEPSettingProvider>
                      )}
                    </MetricsDataSwitcher>
                  </MetricsCardinalityProvider>
                </NoProjectMessage>
              </MetricsResultsMetaProvider>
            </MetricsDashboardContextProvider>
          </OnDemandControlProvider>
        </Layout.Page>
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
    const {
      api,
      organization,
      dashboard,
      dashboards,
      params,
      router,
      location,
      newWidget,
      onSetNewWidget,
      onDashboardUpdate,
      projects,
    } = this.props;
    const {modifiedDashboard, dashboardState, widgetLimitReached, seriesData, setData} =
      this.state;
    const {dashboardId} = params;

    const hasUnsavedFilters =
      dashboard.id !== 'default-overview' &&
      dashboardState !== DashboardState.CREATE &&
      hasUnsavedFilterChanges(dashboard, location);

    const eventView = generatePerformanceEventView(location, projects, {}, organization);

    const isDashboardUsingTransaction = dashboard.widgets.some(
      isWidgetUsingTransactionName
    );

    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={organization.slug}>
        <PageFiltersContainer
          disablePersistence
          defaultSelection={{
            datetime: {
              start: null,
              end: null,
              utc: false,
              period: DEFAULT_STATS_PERIOD,
            },
          }}
        >
          <Layout.Page>
            <OnDemandControlProvider location={location}>
              <MetricsDashboardContextProvider>
                <MetricsResultsMetaProvider>
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
                            isEditingDashboard={this.isEditingDashboard}
                          />
                        </Layout.Title>
                      </Layout.HeaderContent>
                      <Layout.HeaderActions>
                        <Controls
                          organization={organization}
                          dashboards={dashboards}
                          hasUnsavedFilters={hasUnsavedFilters}
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
                        <MetricsCardinalityProvider
                          organization={organization}
                          location={location}
                        >
                          <MetricsDataSwitcher
                            organization={organization}
                            eventView={eventView}
                            location={location}
                          >
                            {metricsDataSide => (
                              <MEPSettingProvider
                                location={location}
                                forceTransactions={metricsDataSide.forceTransactionsOnly}
                              >
                                {isDashboardUsingTransaction ? (
                                  <MetricsDataSwitcherAlert
                                    organization={organization}
                                    eventView={eventView}
                                    projects={projects}
                                    location={location}
                                    router={router}
                                    source={DiscoverQueryPageSource.DISCOVER}
                                    {...metricsDataSide}
                                  />
                                ) : null}
                                <FiltersBar
                                  filters={(modifiedDashboard ?? dashboard).filters}
                                  location={location}
                                  hasUnsavedChanges={hasUnsavedFilters}
                                  isEditingDashboard={
                                    dashboardState !== DashboardState.CREATE &&
                                    this.isEditingDashboard
                                  }
                                  isPreview={this.isPreview}
                                  onDashboardFilterChange={this.handleChangeFilter}
                                  onCancel={() => {
                                    resetPageFilters(dashboard, location);
                                    this.setState({
                                      modifiedDashboard: {
                                        ...(modifiedDashboard ?? dashboard),
                                        filters: dashboard.filters,
                                      },
                                    });
                                  }}
                                  onSave={() => {
                                    const newModifiedDashboard = {
                                      ...cloneDashboard(modifiedDashboard ?? dashboard),
                                      ...getCurrentPageFilters(location),
                                      filters:
                                        getDashboardFiltersFromURL(location) ??
                                        (modifiedDashboard ?? dashboard).filters,
                                    };
                                    updateDashboard(
                                      api,
                                      organization.slug,
                                      newModifiedDashboard
                                    ).then(
                                      (newDashboard: DashboardDetails) => {
                                        addSuccessMessage(t('Dashboard filters updated'));

                                        const navigateToDashboard = () => {
                                          browserHistory.replace(
                                            normalizeUrl({
                                              pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
                                              query: omit(
                                                location.query,
                                                Object.values(DashboardFilterKeys)
                                              ),
                                            })
                                          );
                                        };

                                        if (onDashboardUpdate) {
                                          onDashboardUpdate(newDashboard);
                                          this.setState(
                                            {
                                              modifiedDashboard: null,
                                            },
                                            () => {
                                              // Wait for modifiedDashboard state to update before navigating
                                              navigateToDashboard();
                                            }
                                          );
                                          return;
                                        }

                                        navigateToDashboard();
                                      },
                                      // `updateDashboard` does its own error handling
                                      () => undefined
                                    );
                                  }}
                                />

                                <WidgetViewerContext.Provider
                                  value={{seriesData, setData}}
                                >
                                  <Dashboard
                                    paramDashboardId={dashboardId}
                                    dashboard={modifiedDashboard ?? dashboard}
                                    organization={organization}
                                    isEditingDashboard={this.isEditingDashboard}
                                    widgetLimitReached={widgetLimitReached}
                                    onUpdate={this.onUpdateWidget}
                                    handleUpdateWidgetList={this.handleUpdateWidgetList}
                                    handleAddCustomWidget={this.handleAddCustomWidget}
                                    handleAddMetricWidget={this.handleAddMetricWidget}
                                    router={router}
                                    location={location}
                                    newWidget={newWidget}
                                    onSetNewWidget={onSetNewWidget}
                                    isPreview={this.isPreview}
                                  />
                                </WidgetViewerContext.Provider>
                              </MEPSettingProvider>
                            )}
                          </MetricsDataSwitcher>
                        </MetricsCardinalityProvider>
                      </Layout.Main>
                    </Layout.Body>
                  </NoProjectMessage>
                </MetricsResultsMetaProvider>
              </MetricsDashboardContextProvider>
            </OnDemandControlProvider>
          </Layout.Page>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    );
  }

  render() {
    const {organization} = this.props;

    if (this.isWidgetBuilderRouter) {
      return this.renderWidgetBuilder();
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: minmax(0, 1fr) max-content;
    grid-column-gap: ${space(2)};
    height: 40px;
  }
`;

export default withPageFilters(withProjects(withApi(withOrganization(DashboardDetail))));
