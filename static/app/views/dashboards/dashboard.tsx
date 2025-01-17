import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Component} from 'react';
import type {Layouts} from 'react-grid-layout';
import {Responsive, WidthProvider} from 'react-grid-layout';
import {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';
import type {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {IconResize} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DatasetSource} from 'sentry/utils/discover/types';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import theme from 'sentry/utils/theme';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';

import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from './addWidget';
import type {Position} from './layoutUtils';
import {
  assignDefaultLayout,
  assignTempId,
  calculateColumnDepths,
  constructGridItemKey,
  DEFAULT_WIDGET_WIDTH,
  enforceWidgetHeightValues,
  generateWidgetId,
  generateWidgetsAfterCompaction,
  getDashboardLayout,
  getDefaultWidgetHeight,
  getMobileLayout,
  getNextAvailablePosition,
  isValidLayout,
  METRIC_WIDGET_MIN_SIZE,
  pickDefinedStoreKeys,
} from './layoutUtils';
import SortableWidget from './sortableWidget';
import type {DashboardDetails, Widget} from './types';
import {DashboardWidgetSource, WidgetType} from './types';
import {connectDashboardCharts, getDashboardFiltersFromURL} from './utils';
import type WidgetLegendSelectionState from './widgetLegendSelectionState';

export const DRAG_HANDLE_CLASS = 'widget-drag';
const DRAG_RESIZE_CLASS = 'widget-resize';
const DESKTOP = 'desktop';
const MOBILE = 'mobile';
export const NUM_DESKTOP_COLS = 6;
const NUM_MOBILE_COLS = 2;
const ROW_HEIGHT = 120;
const WIDGET_MARGINS: [number, number] = [16, 16];
const BOTTOM_MOBILE_VIEW_POSITION = {
  x: 0,
  y: Number.MAX_SAFE_INTEGER,
};
const MOBILE_BREAKPOINT = parseInt(theme.breakpoints.small, 10);
const BREAKPOINTS = {[MOBILE]: 0, [DESKTOP]: MOBILE_BREAKPOINT};
const COLUMNS = {[MOBILE]: NUM_MOBILE_COLS, [DESKTOP]: NUM_DESKTOP_COLS};
export const DASHBOARD_CHART_GROUP = 'dashboard-group';

type Props = {
  api: Client;
  dashboard: DashboardDetails;
  handleAddCustomWidget: (widget: Widget) => void;
  handleUpdateWidgetList: (widgets: Widget[]) => void;
  isEditingDashboard: boolean;
  location: Location;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  widgetLegendState: WidgetLegendSelectionState;
  widgetLimitReached: boolean;
  handleAddMetricWidget?: (layout?: Widget['layout']) => void;
  handleChangeSplitDataset?: (widget: Widget, index: number) => void;
  isPreview?: boolean;
  newWidget?: Widget;
  onAddWidget?: (dataset?: DataSet) => void;
  onAddWidgetFromNewWidgetBuilder?: (
    dataset: DataSet,
    openWidgetTemplates?: boolean
  ) => void;
  onEditWidget?: (widget: Widget) => void;
  onSetNewWidget?: () => void;
  paramDashboardId?: string;
  paramTemplateId?: string;
};

type State = {
  isMobile: boolean;
  layouts: Layouts;
  windowWidth: number;
};

class Dashboard extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const {dashboard} = props;
    const desktopLayout = getDashboardLayout(dashboard.widgets);
    this.state = {
      isMobile: false,
      layouts: {
        [DESKTOP]: desktopLayout,
        [MOBILE]: getMobileLayout(desktopLayout, dashboard.widgets),
      },
      windowWidth: window.innerWidth,
    };
  }

  static getDerivedStateFromProps(props: any, state: any) {
    if (state.isMobile) {
      // Don't need to recalculate any layout state from props in the mobile view
      // because we want to force different positions (i.e. new widgets added
      // at the bottom)
      return null;
    }

    // If the user clicks "Cancel" and the dashboard resets,
    // recalculate the layout to revert to the unmodified state
    const dashboardLayout = getDashboardLayout(props.dashboard.widgets);
    if (
      !isEqual(
        dashboardLayout.map(pickDefinedStoreKeys),
        state.layouts[DESKTOP].map(pickDefinedStoreKeys)
      )
    ) {
      return {
        ...state,
        layouts: {
          [DESKTOP]: dashboardLayout,
          [MOBILE]: getMobileLayout(dashboardLayout, props.dashboard.widgets),
        },
      };
    }
    return null;
  }

  componentDidMount() {
    const {newWidget} = this.props;
    window.addEventListener('resize', this.debouncedHandleResize);

    // Always load organization tags on dashboards
    this.fetchTags();

    if (newWidget) {
      this.addNewWidget();
    }

    // Get member list data for issue widgets
    this.fetchMemberList();

    connectDashboardCharts(DASHBOARD_CHART_GROUP);
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, newWidget} = this.props;

    if (newWidget && newWidget !== prevProps.newWidget) {
      this.addNewWidget();
    }
    if (!isEqual(prevProps.selection.projects, selection.projects)) {
      this.fetchMemberList();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.debouncedHandleResize);
    window.clearTimeout(this.forceCheckTimeout);
    GroupStore.reset();
  }

  forceCheckTimeout: number | undefined = undefined;

  debouncedHandleResize = debounce(() => {
    this.setState({
      windowWidth: window.innerWidth,
    });
  }, 250);

  fetchMemberList() {
    const {api, selection} = this.props;
    // Stores MemberList in MemberListStore for use in modals and sets state for use is child components
    fetchOrgMembers(
      api,
      this.props.organization.slug,
      selection.projects?.map(projectId => String(projectId))
    );
  }

  async addNewWidget() {
    const {api, organization, newWidget, handleAddCustomWidget, onSetNewWidget} =
      this.props;
    if (newWidget) {
      try {
        await validateWidget(api, organization.slug, newWidget);
        handleAddCustomWidget(newWidget);
        onSetNewWidget?.();
      } catch (error) {
        // Don't do anything, widget isn't valid
        addErrorMessage(error);
      }
    }
  }

  fetchTags() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
  }

  handleStartAdd = (dataset?: DataSet) => {
    const {
      organization,
      router,
      location,
      paramDashboardId,
      handleAddMetricWidget,
      onAddWidget,
    } = this.props;

    if (dataset === DataSet.METRICS) {
      handleAddMetricWidget?.({...this.addWidgetLayout, ...METRIC_WIDGET_MIN_SIZE});
      return;
    }

    if (!organization.features.includes('dashboards-widget-builder-redesign')) {
      if (paramDashboardId) {
        router.push(
          normalizeUrl({
            pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/new/`,
            query: {
              ...location.query,
              source: DashboardWidgetSource.DASHBOARDS,
              dataset,
            },
          })
        );
        return;
      }

      router.push(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
          query: {
            ...location.query,
            source: DashboardWidgetSource.DASHBOARDS,
            dataset,
          },
        })
      );

      return;
    }

    onAddWidget?.();
    return;
  };

  handleUpdateComplete = (prevWidget: Widget) => (nextWidget: Widget) => {
    const {isEditingDashboard, onUpdate, handleUpdateWidgetList} = this.props;

    let nextList = [...this.props.dashboard.widgets];
    const updateIndex = nextList.indexOf(prevWidget);
    const nextWidgetData = {
      ...nextWidget,
      tempId: prevWidget.tempId,
    };

    // Only modify and re-compact if the default height has changed
    if (
      getDefaultWidgetHeight(prevWidget.displayType) !==
      getDefaultWidgetHeight(nextWidget.displayType)
    ) {
      nextList[updateIndex] = enforceWidgetHeightValues(nextWidgetData);
      nextList = generateWidgetsAfterCompaction(nextList);
    } else {
      nextList[updateIndex] = nextWidgetData;
    }

    onUpdate(nextList);
    if (!isEditingDashboard) {
      handleUpdateWidgetList(nextList);
    }
  };

  handleDeleteWidget = (widgetToDelete: Widget) => () => {
    const {
      organization,
      dashboard,
      onUpdate,
      isEditingDashboard,
      handleUpdateWidgetList,
    } = this.props;

    trackAnalytics('dashboards_views.widget.delete', {
      organization,
      widget_type: widgetToDelete.displayType,
    });

    let nextList = dashboard.widgets.filter(widget => widget !== widgetToDelete);
    nextList = generateWidgetsAfterCompaction(nextList);

    onUpdate(nextList);

    if (!isEditingDashboard) {
      handleUpdateWidgetList(nextList);
    }
  };

  handleDuplicateWidget = (widget: Widget, index: number) => () => {
    const {
      organization,
      dashboard,
      onUpdate,
      isEditingDashboard,
      handleUpdateWidgetList,
    } = this.props;

    trackAnalytics('dashboards_views.widget.duplicate', {
      organization,
      widget_type: widget.displayType,
    });

    const widgetCopy = cloneDeep(
      assignTempId({...widget, id: undefined, tempId: undefined})
    );

    let nextList = [...dashboard.widgets];
    nextList.splice(index, 0, widgetCopy);
    nextList = generateWidgetsAfterCompaction(nextList);

    onUpdate(nextList);
    if (!isEditingDashboard) {
      handleUpdateWidgetList(nextList);
    }
  };

  handleChangeSplitDataset = (widget: Widget, index: number) => {
    const {dashboard, onUpdate, isEditingDashboard, handleUpdateWidgetList} = this.props;

    const widgetCopy = cloneDeep({
      ...widget,
      id: undefined,
    });

    const nextList = [...dashboard.widgets];
    const nextWidgetData = {
      ...widgetCopy,
      widgetType: WidgetType.TRANSACTIONS,
      datasetSource: DatasetSource.USER,
      id: widget.id,
    };
    nextList[index] = nextWidgetData;

    onUpdate(nextList);
    if (!isEditingDashboard) {
      handleUpdateWidgetList(nextList);
    }
  };

  handleEditWidget = (index: number) => () => {
    const {organization, router, location, paramDashboardId, onEditWidget} = this.props;
    const widget = this.props.dashboard.widgets[index]!;

    trackAnalytics('dashboards_views.widget.edit', {
      organization,
      widget_type: widget.displayType,
    });

    if (widget.widgetType === WidgetType.METRICS) {
      return;
    }

    if (organization.features.includes('dashboards-widget-builder-redesign')) {
      onEditWidget?.(widget);
      return;
    }

    if (paramDashboardId) {
      router.push(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/${index}/edit/`,
          query: {
            ...location.query,
            source: DashboardWidgetSource.DASHBOARDS,
          },
        })
      );
      return;
    }

    router.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboards/new/widget/${index}/edit/`,
        query: {
          ...location.query,
          source: DashboardWidgetSource.DASHBOARDS,
        },
      })
    );

    return;
  };

  getWidgetIds() {
    return [
      ...this.props.dashboard.widgets.map((widget, index): string => {
        return generateWidgetId(widget, index);
      }),
      ADD_WIDGET_BUTTON_DRAG_ID,
    ];
  }

  renderWidget(widget: Widget, index: number) {
    const {isMobile, windowWidth} = this.state;
    const {isEditingDashboard, widgetLimitReached, isPreview, dashboard, location} =
      this.props;

    const widgetProps = {
      widget,
      widgetLegendState: this.props.widgetLegendState,
      isEditingDashboard,
      widgetLimitReached,
      onDelete: this.handleDeleteWidget(widget),
      onEdit: this.handleEditWidget(index),
      onDuplicate: this.handleDuplicateWidget(widget, index),
      onSetTransactionsDataset: () => this.handleChangeSplitDataset(widget, index),

      isPreview,

      dashboardFilters: getDashboardFiltersFromURL(location) ?? dashboard.filters,
    };

    const key = constructGridItemKey(widget);

    return (
      <div key={key} data-grid={widget.layout}>
        <SortableWidget
          {...widgetProps}
          dashboardPermissions={dashboard.permissions}
          dashboardCreator={dashboard.createdBy}
          isMobile={isMobile}
          windowWidth={windowWidth}
          index={String(index)}
        />
      </div>
    );
  }

  handleLayoutChange = (_: any, allLayouts: Layouts) => {
    const {isMobile} = this.state;
    const {dashboard, onUpdate} = this.props;
    const isNotAddButton = ({i}: any) => i !== ADD_WIDGET_BUTTON_DRAG_ID;
    const newLayouts = {
      [DESKTOP]: allLayouts[DESKTOP]!.filter(isNotAddButton),
      [MOBILE]: allLayouts[MOBILE]!.filter(isNotAddButton),
    };

    // Generate a new list of widgets where the layouts are associated
    let columnDepths = calculateColumnDepths(newLayouts[DESKTOP]);
    const newWidgets = dashboard.widgets.map(widget => {
      const gridKey = constructGridItemKey(widget);
      let matchingLayout = newLayouts[DESKTOP].find(({i}) => i === gridKey);
      if (!matchingLayout) {
        const height = getDefaultWidgetHeight(widget.displayType);
        const defaultWidgetParams = {
          w: DEFAULT_WIDGET_WIDTH,
          h: height,
          minH: height,
          i: gridKey,
        };

        // Calculate the available position
        const [nextPosition, nextColumnDepths] = getNextAvailablePosition(
          columnDepths,
          height
        );
        columnDepths = nextColumnDepths;

        // Set the position for the desktop layout
        matchingLayout = {
          ...defaultWidgetParams,
          ...nextPosition,
        };

        if (isMobile) {
          // This is a new widget and it's on the mobile page so we keep it at the bottom
          const mobileLayout = newLayouts[MOBILE].filter(({i}) => i !== gridKey);
          mobileLayout.push({
            ...defaultWidgetParams,
            ...BOTTOM_MOBILE_VIEW_POSITION,
          });
          newLayouts[MOBILE] = mobileLayout;
        }
      }
      return {
        ...widget,
        layout: pickDefinedStoreKeys(matchingLayout),
      };
    });

    this.setState({
      layouts: newLayouts,
    });
    onUpdate(newWidgets);

    // Force check lazyLoad elements that might have shifted into view after (re)moving an upper widget
    // Unfortunately need to use window.setTimeout since React Grid Layout animates widgets into view when layout changes
    // RGL doesn't provide a handler for post animation layout change
    window.clearTimeout(this.forceCheckTimeout);
    this.forceCheckTimeout = window.setTimeout(forceCheck, 400);
  };

  handleBreakpointChange = (newBreakpoint: string) => {
    const {layouts} = this.state;
    const {
      dashboard: {widgets},
    } = this.props;

    if (newBreakpoint === MOBILE) {
      this.setState({
        isMobile: true,
        layouts: {
          ...layouts,
          [MOBILE]: getMobileLayout(layouts[DESKTOP]!, widgets),
        },
      });
      return;
    }
    this.setState({isMobile: false});
  };

  get addWidgetLayout() {
    const {isMobile, layouts} = this.state;
    let position: Position = BOTTOM_MOBILE_VIEW_POSITION;
    if (!isMobile) {
      const columnDepths = calculateColumnDepths(layouts[DESKTOP]!);
      const [nextPosition] = getNextAvailablePosition(columnDepths, 1);
      position = nextPosition;
    }
    return {
      ...position,
      w: DEFAULT_WIDGET_WIDTH,
      h: 1,
      isResizable: false,
    };
  }

  render() {
    const {layouts, isMobile} = this.state;
    const {
      isEditingDashboard,
      dashboard,
      widgetLimitReached,
      organization,
      isPreview,
      onAddWidgetFromNewWidgetBuilder,
    } = this.props;
    const {widgets} = dashboard;

    const columnDepths = calculateColumnDepths(layouts[DESKTOP]!);

    const widgetsWithLayout = assignDefaultLayout(widgets, columnDepths);

    const canModifyLayout = !isMobile && isEditingDashboard;

    const displayInlineAddWidget =
      hasCustomMetrics(organization) &&
      isValidLayout({...this.addWidgetLayout, i: ADD_WIDGET_BUTTON_DRAG_ID});

    return (
      <GridLayout
        breakpoints={BREAKPOINTS}
        cols={COLUMNS}
        rowHeight={ROW_HEIGHT}
        margin={WIDGET_MARGINS}
        draggableHandle={`.${DRAG_HANDLE_CLASS}`}
        draggableCancel={`.${DRAG_RESIZE_CLASS}`}
        layouts={layouts}
        onLayoutChange={this.handleLayoutChange}
        onBreakpointChange={this.handleBreakpointChange}
        isDraggable={canModifyLayout}
        isResizable={canModifyLayout}
        resizeHandle={
          <ResizeHandle
            aria-label={t('Resize Widget')}
            data-test-id="custom-resize-handle"
            className={DRAG_RESIZE_CLASS}
            size="xs"
            borderless
            icon={<IconResize />}
          />
        }
        useCSSTransforms={false}
        isBounded
      >
        {widgetsWithLayout.map((widget, index) => this.renderWidget(widget, index))}
        {(isEditingDashboard || displayInlineAddWidget) &&
          !widgetLimitReached &&
          !isPreview && (
            <AddWidgetWrapper
              key={ADD_WIDGET_BUTTON_DRAG_ID}
              data-grid={this.addWidgetLayout}
            >
              <AddWidget
                onAddWidget={this.handleStartAdd}
                onAddWidgetFromNewWidgetBuilder={onAddWidgetFromNewWidgetBuilder}
              />
            </AddWidgetWrapper>
          )}
      </GridLayout>
    );
  }
}

export default withApi(withPageFilters(Dashboard));

// A widget being dragged has a z-index of 3
// Allow the Add Widget tile to show above widgets when moved
const AddWidgetWrapper = styled('div')`
  z-index: 5;
  background-color: ${p => p.theme.background};
`;

const GridLayout = styled(WidthProvider(Responsive))`
  margin: -${space(2)};

  .react-grid-item.react-grid-placeholder {
    background: ${p => p.theme.purple200};
    border-radius: ${p => p.theme.borderRadius};
  }
`;

const ResizeHandle = styled(Button)`
  position: absolute;
  z-index: 2;
  bottom: ${space(0.5)};
  right: ${space(0.5)};
  color: ${p => p.theme.subText};
  cursor: nwse-resize;

  .react-resizable-hide & {
    display: none;
  }
`;
