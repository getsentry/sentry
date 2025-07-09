import {cloneElement, Component, Fragment, isValidElement} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import isEqualWith from 'lodash/isEqualWith';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import {
  createDashboard,
  deleteDashboard,
  updateDashboard,
  updateDashboardPermissions,
} from 'sentry/actionCreators/dashboards';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openWidgetViewerModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {hasEveryAccess} from 'sentry/components/acl/access';
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
import type {PageFilters} from 'sentry/types/core';
import type {PlainRoute, RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MetricsResultsMetaProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OnDemandControlProvider} from 'sentry/utils/performance/contexts/onDemandControl';
import {OnRouteLeave} from 'sentry/utils/reactRouter6Compat/onRouteLeave';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import {
  cloneDashboard,
  getCurrentPageFilters,
  getDashboardFiltersFromURL,
  hasUnsavedFilterChanges,
  isWidgetUsingTransactionName,
  resetPageFilters,
} from 'sentry/views/dashboards/utils';
import WidgetBuilderV2 from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getDefaultWidget} from 'sentry/views/dashboards/widgetBuilder/utils/getDefaultWidget';
import {DATA_SET_TO_WIDGET_TYPE} from 'sentry/views/dashboards/widgetBuilder/widgetBuilder';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import {getTopNConvertedDefaultWidgets} from 'sentry/views/dashboards/widgetLibrary/data';
import {generatePerformanceEventView} from 'sentry/views/performance/data';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';
import {MetricsDataSwitcherAlert} from 'sentry/views/performance/landing/metricsDataSwitcherAlert';
import {DiscoverQueryPageSource} from 'sentry/views/performance/utils';

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
  getDashboardLayout,
} from './layoutUtils';
import DashboardTitle from './title';
import type {
  DashboardDetails,
  DashboardFilters,
  DashboardListItem,
  DashboardPermissions,
  Widget,
} from './types';
import {DashboardFilterKeys, DashboardState, MAX_WIDGETS, WidgetType} from './types';
import WidgetLegendSelectionState from './widgetLegendSelectionState';

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

type Props = RouteComponentProps<RouteParams> & {
  api: Client;
  dashboard: DashboardDetails;
  dashboards: DashboardListItem[];
  initialState: DashboardState;
  navigate: ReactRouter3Navigate;
  organization: Organization;
  projects: Project[];
  route: PlainRoute;
  selection: PageFilters;
  theme: Theme;
  children?: React.ReactNode;
  newWidget?: Widget;
  onDashboardUpdate?: (updatedDashboard: DashboardDetails) => void;
  onSetNewWidget?: () => void;
};

type State = {
  dashboardState: DashboardState;
  isCommittingChanges: boolean;
  isSavingDashboardFilters: boolean;
  isWidgetBuilderOpen: boolean;
  modifiedDashboard: DashboardDetails | null;
  widgetLegendState: WidgetLegendSelectionState;
  widgetLimitReached: boolean;
  newlyAddedWidget?: Widget;
  openWidgetTemplates?: boolean;
} & WidgetViewerContextProps;

export function handleUpdateDashboardSplit({
  widgetId,
  splitDecision,
  dashboard,
  onDashboardUpdate,
  modifiedDashboard,
  stateSetter,
}: {
  dashboard: DashboardDetails;
  modifiedDashboard: DashboardDetails | null;
  splitDecision: WidgetType;
  stateSetter: Component<Props, State, any>['setState'];
  widgetId: string;
  onDashboardUpdate?: (updatedDashboard: DashboardDetails) => void;
}) {
  // The underlying dashboard needs to be updated with the split decision
  // because the backend has evaluated the query and stored that value
  const updatedDashboard = cloneDashboard(dashboard);
  const widgetIndex = updatedDashboard.widgets.findIndex(
    widget =>
      (defined(widget.id) && widget.id === widgetId) ||
      (defined(widget.tempId) && widget.tempId === widgetId)
  );

  if (widgetIndex >= 0) {
    updatedDashboard.widgets[widgetIndex]!.widgetType = splitDecision;
  }
  onDashboardUpdate?.(updatedDashboard);

  // The modified dashboard also needs to be updated because that dashboard
  // is rendered instead of the original dashboard when editing
  if (modifiedDashboard) {
    stateSetter(state => ({
      ...state,
      modifiedDashboard: {
        ...state.modifiedDashboard!,
        widgets: state.modifiedDashboard!.widgets.map(widget =>
          widget.id === widgetId ? {...widget, widgetType: splitDecision} : widget
        ),
      },
    }));
  }
}

/* Checks if current user has permissions to edit dashboard */
export function checkUserHasEditAccess(
  currentUser: User,
  userTeams: Team[],
  organization: Organization,
  dashboardPermissions?: DashboardPermissions,
  dashboardCreator?: User
): boolean {
  if (
    hasEveryAccess(['org:admin'], {organization}) || // Owners
    !dashboardPermissions ||
    dashboardPermissions.isEditableByEveryone ||
    dashboardCreator?.id === currentUser.id
  ) {
    return true;
  }
  if (dashboardPermissions.teamsWithEditAccess?.length) {
    const userTeamIds = userTeams.map(team => Number(team.id));
    return dashboardPermissions.teamsWithEditAccess.some(teamId =>
      userTeamIds.includes(teamId)
    );
  }
  return false;
}

function getDashboardLocation({
  organization,
  dashboardId,
  location,
}: {
  location: Location<any>;
  organization: Organization;
  dashboardId?: string;
}) {
  // Preserve important filter params
  const filterParams = pick(location.query, [
    'release',
    'environment',
    'project',
    'statsPeriod',
    'start',
    'end',
  ]);

  const commonPath = defined(dashboardId)
    ? `/dashboard/${dashboardId}/`
    : `/dashboards/new/`;

  const dashboardUrl = USING_CUSTOMER_DOMAIN
    ? commonPath
    : `/organizations/${organization.slug}${commonPath}`;

  return normalizeUrl({
    pathname: dashboardUrl,
    query: filterParams,
  });
}

class DashboardDetail extends Component<Props, State> {
  state: State = {
    dashboardState: this.props.initialState,
    modifiedDashboard: this.updateModifiedDashboard(this.props.initialState),
    widgetLimitReached: this.props.dashboard.widgets.length >= MAX_WIDGETS,
    setData: data => {
      this.setState(data);
    },
    widgetLegendState: new WidgetLegendSelectionState({
      dashboard: this.props.dashboard,
      organization: this.props.organization,
      location: this.props.location,
      navigate: this.props.navigate,
    }),
    isSavingDashboardFilters: false,
    isWidgetBuilderOpen: false,
    openWidgetTemplates: undefined,
    newlyAddedWidget: undefined,
    isCommittingChanges: false,
  };

  componentDidMount() {
    this.checkIfShouldMountWidgetViewerModal();
    if (this.isWidgetBuilder()) {
      this.setState({isWidgetBuilderOpen: true});
    }
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  componentDidUpdate(prevProps: Props) {
    this.checkIfShouldMountWidgetViewerModal();

    if (prevProps.initialState !== this.props.initialState) {
      // Widget builder can toggle Edit state when saving
      this.setState({dashboardState: this.props.initialState});
    }

    if (
      prevProps.organization !== this.props.organization ||
      prevProps.location !== this.props.location ||
      prevProps.router !== this.props.router ||
      prevProps.dashboard !== this.props.dashboard
    ) {
      this.setState({
        widgetLegendState: new WidgetLegendSelectionState({
          organization: this.props.organization,
          location: this.props.location,
          navigate: this.props.navigate,
          dashboard: this.props.dashboard,
        }),
      });
    }
  }

  componentWillUnmount(): void {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  checkIfShouldMountWidgetViewerModal() {
    const {
      params: {widgetId},
      organization,
      dashboard,
      location,
      router,
      navigate,
    } = this.props;
    const {
      seriesData,
      tableData,
      pageLinks,
      totalIssuesCount,
      seriesResultsType,
      confidence,
      sampleCount,
      modifiedDashboard,
    } = this.state;
    if (isWidgetViewerPath(location.pathname)) {
      const widget = (modifiedDashboard ?? dashboard).widgets[Number(widgetId)];
      if (widget) {
        openWidgetViewerModal({
          organization,
          widget,
          seriesData: WidgetLegendNameEncoderDecoder.modifyTimeseriesNames(
            widget,
            seriesData
          ),
          seriesResultsType,
          tableData,
          pageLinks,
          totalIssuesCount,
          widgetLegendState: this.state.widgetLegendState,
          dashboardFilters: getDashboardFiltersFromURL(location) ?? dashboard.filters,
          dashboardPermissions: dashboard.permissions,
          dashboardCreator: dashboard.createdBy,
          onMetricWidgetEdit: (updatedWidget: Widget) => {
            const widgets = [...dashboard.widgets];

            const widgetIndex = dashboard.widgets.indexOf(widget);
            widgets[widgetIndex] = {...widgets[widgetIndex], ...updatedWidget};

            this.handleUpdateWidgetList(widgets);
          },
          onClose: () => {
            // Filter out Widget Viewer Modal query params when exiting the Modal
            const query = omit(location.query, Object.values(WidgetViewerQueryField));
            navigate(
              {
                pathname: location.pathname.replace(/widget\/[0-9]+\/$/, ''),
                query,
              },
              {preventScrollReset: true}
            );
          },
          onEdit: () => {
            const widgetIndex = dashboard.widgets.findIndex(
              w =>
                (defined(widget.id) && w.id === widget.id) ||
                (defined(widget.tempId) && w.tempId === widget.tempId)
            );
            if (widgetIndex === -1) {
              Sentry.setTag('edit_source', 'modal');
              Sentry.captureMessage('Attempted edit of widget not found in dashboard', {
                level: 'error',
                extra: {widget, dashboard},
              });
              return;
            }

            this.onEditWidget(widget);
            return;
          },
          confidence,
          sampleCount,
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

  get dashboardTitle() {
    const {dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    return modifiedDashboard ? modifiedDashboard.title : dashboard.title;
  }

  handleBeforeUnload = (event: BeforeUnloadEvent) => {
    const {dashboard} = this.props;
    const {modifiedDashboard, isCommittingChanges, isSavingDashboardFilters} = this.state;

    // Conditions outside of the editing state that we want to trigger the
    // message for.
    const warnOnSaving = isCommittingChanges || isSavingDashboardFilters;
    if (
      (defined(modifiedDashboard) &&
        !isEqual(modifiedDashboard, dashboard) &&
        this.isEditingDashboard) ||
      warnOnSaving
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  };

  isWidgetBuilder = (path?: string) => {
    const {organization, location, params} = this.props;
    const {dashboardId, widgetIndex} = params;

    const widgetBuilderRoutes = [
      `/organizations/${organization.slug}/dashboards/new/widget-builder/widget/new/`,
      `/organizations/${organization.slug}/dashboards/new/widget-builder/widget/${widgetIndex}/edit/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget-builder/widget/new/`,
      `/organizations/${organization.slug}/dashboard/${dashboardId}/widget-builder/widget/${widgetIndex}/edit/`,
    ];

    if (USING_CUSTOMER_DOMAIN) {
      widgetBuilderRoutes.push(
        ...[
          `/dashboards/new/widget-builder/widget/new/`,
          `/dashboards/new/widget-builder/widget/${widgetIndex}/edit/`,
          `/dashboard/${dashboardId}/widget-builder/widget/new/`,
          `/dashboard/${dashboardId}/widget-builder/widget/${widgetIndex}/edit/`,
        ]
      );
    }

    return widgetBuilderRoutes.includes(path ?? location.pathname);
  };

  onEdit = () => {
    const {dashboard, organization} = this.props;
    trackAnalytics('dashboards2.edit.start', {organization});

    this.setState({
      dashboardState: DashboardState.EDIT,
      modifiedDashboard: cloneDashboard(dashboard),
    });
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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        key => !newModifiedDashboard.filters?.[key] && activeFilters[key].length === 0
      )
    ) {
      return;
    }

    const filterParams: DashboardFilters = {};
    Object.keys(activeFilters).forEach(key => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      isCommittingChanges: true,
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
            isCommittingChanges: false,
          });
        }
        const legendQuery =
          this.state.widgetLegendState.setMultipleWidgetSelectionStateURL(newDashboard);

        if (dashboard && newDashboard.id !== dashboard.id) {
          this.props.router.replace(
            normalizeUrl({
              pathname: `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`,
              query: {
                ...location.query,
                unselectedSeries: legendQuery,
              },
            })
          );
        }
        addSuccessMessage(t('Dashboard updated'));

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

  handleScrollToNewWidgetComplete = () => {
    this.setState({
      newlyAddedWidget: undefined,
    });
  };

  onAddWidget = (dataset: DataSet, openWidgetTemplates?: boolean) => {
    const {
      organization,
      dashboard,
      navigate,
      location,
      params: {dashboardId},
    } = this.props;
    const {modifiedDashboard} = this.state;
    this.setState(
      {
        modifiedDashboard: cloneDashboard(modifiedDashboard ?? dashboard),
      },
      () => {
        this.setState({
          isWidgetBuilderOpen: true,
          openWidgetTemplates: openWidgetTemplates ?? false,
        });
        let pathname = `/organizations/${organization.slug}/dashboard/${dashboardId}/widget-builder/widget/new/`;
        if (!defined(dashboardId)) {
          pathname = `/organizations/${organization.slug}/dashboards/new/widget-builder/widget/new/`;
        }

        const defaultLibraryWidget = getTopNConvertedDefaultWidgets(organization)[0];
        navigate(
          normalizeUrl({
            // TODO: Replace with the old widget builder path when swapping over
            pathname,
            query: {
              ...location.query,
              ...(openWidgetTemplates
                ? defaultLibraryWidget
                  ? convertWidgetToBuilderStateParams(defaultLibraryWidget)
                  : {}
                : convertWidgetToBuilderStateParams(
                    getDefaultWidget(DATA_SET_TO_WIDGET_TYPE[dataset ?? DataSet.ERRORS])
                  )),
            },
          }),
          {preventScrollReset: true}
        );
      }
    );

    return;
  };

  onEditWidget = (widget: Widget) => {
    const {navigate, organization, params, location, dashboard} = this.props;
    const {modifiedDashboard} = this.state;
    const currentDashboard = modifiedDashboard ?? dashboard;
    const {dashboardId} = params;

    const widgetIndex = currentDashboard.widgets.findIndex(
      w =>
        (defined(widget.id) && w.id === widget.id) ||
        (defined(widget.tempId) && w.tempId === widget.tempId)
    );
    if (widgetIndex === -1) {
      Sentry.setTag('edit_source', 'context-menu');
      Sentry.captureMessage('Attempted edit of widget not found in dashboard', {
        level: 'error',
        extra: {
          widget,
          currentDashboard,
        },
      });
    }

    this.setState({
      isWidgetBuilderOpen: true,
      openWidgetTemplates: false,
    });
    const path = defined(dashboardId)
      ? `/organizations/${organization.slug}/dashboard/${dashboardId}/widget-builder/widget/${widgetIndex}/edit/`
      : `/organizations/${organization.slug}/dashboards/new/widget-builder/widget/${widgetIndex}/edit/`;
    navigate(
      normalizeUrl({
        pathname: path,
        query: {
          ...location.query,
          ...convertWidgetToBuilderStateParams(widget),
        },
      }),
      {preventScrollReset: true}
    );
  };

  handleSaveWidget = ({index, widget}: {index: number | undefined; widget: Widget}) => {
    const currentDashboard = this.state.modifiedDashboard ?? this.props.dashboard;

    // Get the "base" widget and merge the changes to persist information like tempIds and layout
    const baseWidget = defined(index) ? currentDashboard.widgets[index] : {};
    const mergedWidget = assignTempId({...baseWidget, ...widget});

    const newWidgets = defined(index)
      ? [
          ...currentDashboard.widgets.slice(0, index),
          mergedWidget,
          ...currentDashboard.widgets.slice(index + 1),
        ]
      : [...currentDashboard.widgets, mergedWidget];

    try {
      if (this.isEditingDashboard) {
        // If we're in edit mode, update the edit state
        this.onUpdateWidget(newWidgets);
      } else {
        // If we're not in edit mode, send a request to update the dashboard
        addLoadingMessage(t('Saving widget'));
        this.handleUpdateWidgetList(newWidgets);
      }
      this.setState({
        newlyAddedWidget: mergedWidget,
      });

      this.handleCloseWidgetBuilder();
    } catch (error) {
      addErrorMessage(t('Failed to save widget'));
    }
  };

  /* Handles POST request for Edit Access Selector Changes */
  onChangeEditAccess = (newDashboardPermissions: DashboardPermissions) => {
    const {dashboard, api, organization} = this.props;

    const dashboardCopy = cloneDashboard(dashboard);
    dashboardCopy.permissions = newDashboardPermissions;

    updateDashboardPermissions(api, organization.slug, dashboardCopy).then(
      (newDashboard: DashboardDetails) => {
        addSuccessMessage(t('Dashboard Edit Access updated.'));
        this.props.onDashboardUpdate?.(newDashboard);
        this.setState({
          modifiedDashboard: null,
        });
        return newDashboard;
      }
    );
  };

  handleCloseWidgetBuilder = () => {
    const {organization, navigate, location, params} = this.props;

    this.setState({
      isWidgetBuilderOpen: false,
      openWidgetTemplates: undefined,
    });
    navigate(
      getDashboardLocation({
        organization,
        dashboardId: params.dashboardId,
        location,
      }),
      {preventScrollReset: true}
    );
  };

  handleChangeWidgetBuilderView = (openWidgetTemplates: boolean) => {
    this.setState({openWidgetTemplates});
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
          this.setState({
            isCommittingChanges: true,
          });
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
                  isCommittingChanges: false,
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

  renderWidgetBuilder = () => {
    const {children, dashboard, onDashboardUpdate} = this.props;
    const {modifiedDashboard} = this.state;

    return (
      <Fragment>
        {isValidElement(children)
          ? cloneElement<any>(children, {
              dashboard: modifiedDashboard ?? dashboard,
              onSave: this.isEditingDashboard
                ? this.onUpdateWidget
                : this.handleUpdateWidgetList,
              updateDashboardSplitDecision: (
                widgetId: string,
                splitDecision: WidgetType
              ) => {
                handleUpdateDashboardSplit({
                  widgetId,
                  splitDecision,
                  dashboard,
                  modifiedDashboard,
                  stateSetter: this.setState.bind(this),
                  onDashboardUpdate,
                });
              },
            })
          : children}
      </Fragment>
    );
  };

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
                    dashboard={dashboard}
                    onEdit={this.onEdit}
                    onCancel={this.onCancel}
                    onCommit={this.onCommit}
                    onAddWidget={this.onAddWidget}
                    onChangeEditAccess={this.onChangeEditAccess}
                    onDelete={this.onDelete(dashboard)}
                    dashboardState={dashboardState}
                    widgetLimitReached={widgetLimitReached}
                  />
                </StyledPageHeader>
                <HookHeader organization={organization} />
                <FiltersBar
                  dashboardPermissions={dashboard.permissions}
                  dashboardCreator={dashboard.createdBy}
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
                          theme={this.props.theme}
                          paramDashboardId={dashboardId}
                          dashboard={modifiedDashboard ?? dashboard}
                          organization={organization}
                          isEditingDashboard={this.isEditingDashboard}
                          widgetLimitReached={widgetLimitReached}
                          onUpdate={this.onUpdateWidget}
                          handleUpdateWidgetList={this.handleUpdateWidgetList}
                          handleAddCustomWidget={this.handleAddCustomWidget}
                          isPreview={this.isPreview}
                          router={router}
                          location={location}
                          widgetLegendState={this.state.widgetLegendState}
                        />
                      </MEPSettingProvider>
                    )}
                  </MetricsDataSwitcher>
                </MetricsCardinalityProvider>
              </NoProjectMessage>
            </MetricsResultsMetaProvider>
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
    const {
      modifiedDashboard,
      dashboardState,
      widgetLimitReached,
      seriesData,
      setData,
      newlyAddedWidget,
    } = this.state;
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
        <OnRouteLeave
          message={UNSAVED_MESSAGE}
          when={locationChange => {
            // The widget builder uses its own pathname at the moment, so check if we're navigating
            // between the dashboard and the widget builder
            const checkDashboardRoute = (path: string) => {
              const dashboardRoutes = [
                // Legacy routes
                new RegExp('^\/organizations\/.+\/dashboards\/new\/'),
                new RegExp(`^\/organizations\/.+\/dashboard\/${dashboard.id}\/`),

                // Customer domain routes
                new RegExp('^\/dashboards\/new\/'),
                new RegExp(`^\/dashboard\/${dashboard.id}\/`),
              ];

              return dashboardRoutes.some(route => route.test(path ?? location.pathname));
            };
            const navigatingWithinDashboards =
              checkDashboardRoute(locationChange.nextLocation.pathname) ||
              (checkDashboardRoute(locationChange.currentLocation.pathname) &&
                checkDashboardRoute(locationChange.nextLocation.pathname));
            const hasUnsavedChanges =
              defined(modifiedDashboard) &&
              !isEqual(modifiedDashboard, dashboard) &&
              this.isEditingDashboard;
            return (
              locationChange.currentLocation.pathname !==
                locationChange.nextLocation.pathname &&
              !navigatingWithinDashboards &&
              hasUnsavedChanges
            );
          }}
        />
        <PageFiltersContainer
          disablePersistence
          skipLoadLastUsed
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
                        dashboard={dashboard}
                        hasUnsavedFilters={hasUnsavedFilters}
                        onEdit={this.onEdit}
                        onCancel={this.onCancel}
                        onCommit={this.onCommit}
                        onAddWidget={this.onAddWidget}
                        onDelete={this.onDelete(dashboard)}
                        onChangeEditAccess={this.onChangeEditAccess}
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
                                dashboardPermissions={dashboard.permissions}
                                dashboardCreator={dashboard.createdBy}
                                location={location}
                                hasUnsavedChanges={hasUnsavedFilters}
                                isEditingDashboard={
                                  dashboardState !== DashboardState.CREATE &&
                                  this.isEditingDashboard
                                }
                                isPreview={this.isPreview}
                                onDashboardFilterChange={this.handleChangeFilter}
                                shouldBusySaveButton={this.state.isSavingDashboardFilters}
                                onCancel={() => {
                                  resetPageFilters(dashboard, location);
                                  trackAnalytics('dashboards2.filter.cancel', {
                                    organization,
                                  });

                                  this.setState({
                                    modifiedDashboard: {
                                      ...(modifiedDashboard ?? dashboard),
                                      filters: dashboard.filters,
                                    },
                                  });
                                }}
                                onSave={async () => {
                                  const newModifiedDashboard = {
                                    ...cloneDashboard(modifiedDashboard ?? dashboard),
                                    ...getCurrentPageFilters(location),
                                    filters:
                                      getDashboardFiltersFromURL(location) ??
                                      (modifiedDashboard ?? dashboard).filters,
                                  };
                                  this.setState({isSavingDashboardFilters: true});
                                  addLoadingMessage(t('Saving dashboard filters'));
                                  await updateDashboard(
                                    api,
                                    organization.slug,
                                    newModifiedDashboard
                                  ).then(
                                    (newDashboard: DashboardDetails) => {
                                      addSuccessMessage(t('Dashboard filters updated'));
                                      trackAnalytics('dashboards2.filter.save', {
                                        organization,
                                      });

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
                                            isSavingDashboardFilters: false,
                                          },
                                          () => {
                                            // Wait for modifiedDashboard state to update before navigating
                                            navigateToDashboard();
                                          }
                                        );
                                        return;
                                      }

                                      navigateToDashboard();
                                      this.setState({isSavingDashboardFilters: false});
                                    },
                                    // `updateDashboard` does its own error handling
                                    () => undefined
                                  );
                                }}
                              />

                              <WidgetViewerContext value={{seriesData, setData}}>
                                <Fragment>
                                  <Dashboard
                                    theme={this.props.theme}
                                    paramDashboardId={dashboardId}
                                    dashboard={modifiedDashboard ?? dashboard}
                                    organization={organization}
                                    isEditingDashboard={this.isEditingDashboard}
                                    widgetLimitReached={widgetLimitReached}
                                    onUpdate={this.onUpdateWidget}
                                    handleUpdateWidgetList={this.handleUpdateWidgetList}
                                    handleAddCustomWidget={this.handleAddCustomWidget}
                                    onAddWidget={this.onAddWidget}
                                    router={router}
                                    location={location}
                                    newWidget={newWidget}
                                    onSetNewWidget={onSetNewWidget}
                                    isPreview={this.isPreview}
                                    widgetLegendState={this.state.widgetLegendState}
                                    onEditWidget={this.onEditWidget}
                                    newlyAddedWidget={newlyAddedWidget}
                                    onNewWidgetScrollComplete={
                                      this.handleScrollToNewWidgetComplete
                                    }
                                  />

                                  <WidgetBuilderV2
                                    isOpen={this.state.isWidgetBuilderOpen}
                                    openWidgetTemplates={
                                      this.state.openWidgetTemplates ?? false
                                    }
                                    setOpenWidgetTemplates={
                                      this.handleChangeWidgetBuilderView
                                    }
                                    onClose={this.handleCloseWidgetBuilder}
                                    dashboardFilters={
                                      getDashboardFiltersFromURL(location) ??
                                      dashboard.filters
                                    }
                                    dashboard={modifiedDashboard ?? dashboard}
                                    onSave={this.handleSaveWidget}
                                  />
                                </Fragment>
                              </WidgetViewerContext>
                            </MEPSettingProvider>
                          )}
                        </MetricsDataSwitcher>
                      </MetricsCardinalityProvider>
                    </Layout.Main>
                  </Layout.Body>
                </NoProjectMessage>
              </MetricsResultsMetaProvider>
            </OnDemandControlProvider>
          </Layout.Page>
        </PageFiltersContainer>
      </SentryDocumentTitle>
    );
  }

  render() {
    const {organization} = this.props;

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

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(0, 1fr) max-content;
    grid-column-gap: ${space(2)};
    height: 40px;
  }
`;

function DashboardDetailWithThemeAndNavigate(props: Omit<Props, 'theme' | 'navigate'>) {
  const theme = useTheme();
  const navigate = useNavigate();
  return <DashboardDetail {...props} theme={theme} navigate={navigate} />;
}

export default withPageFilters(
  withProjects(withApi(withOrganization(DashboardDetailWithThemeAndNavigate)))
);
