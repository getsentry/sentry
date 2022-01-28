import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Component} from 'react';
import {Layouts, Responsive, WidthProvider} from 'react-grid-layout';
import {forceCheck} from 'react-lazyload';
import {InjectedRouter} from 'react-router';
import {closestCenter, DndContext} from '@dnd-kit/core';
import {arrayMove, rectSortingStrategy, SortableContext} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import {IconArrow} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';
import withPageFilters from 'sentry/utils/withPageFilters';

import {DataSet} from './widget/utils';
import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from './addWidget';
import {
  calculateColumnDepths,
  constructGridItemKey,
  DEFAULT_WIDGET_WIDTH,
  generateWidgetId,
  getDashboardLayout,
  getDefaultWidgetHeight,
  getMobileLayout,
  getNextAvailablePosition,
  pickDefinedStoreKeys,
  Position,
} from './layoutUtils';
import SortableWidget from './sortableWidget';
import {DashboardDetails, DashboardWidgetSource, Widget, WidgetType} from './types';

export const DRAG_HANDLE_CLASS = 'widget-drag';
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
const MOBILE_BREAKPOINT = parseInt(theme.breakpoints[0], 10);
const BREAKPOINTS = {[MOBILE]: 0, [DESKTOP]: MOBILE_BREAKPOINT};
const COLUMNS = {[MOBILE]: NUM_MOBILE_COLS, [DESKTOP]: NUM_DESKTOP_COLS};

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: PageFilters;
  isEditing: boolean;
  router: InjectedRouter;
  location: Location;
  widgetLimitReached: boolean;
  isPreview?: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
  onSetWidgetToBeUpdated: (widget: Widget) => void;
  handleUpdateWidgetList: (widgets: Widget[]) => void;
  handleAddCustomWidget: (widget: Widget) => void;
  paramDashboardId?: string;
  paramTemplateId?: string;
  newWidget?: Widget;
};

type State = {
  isMobile: boolean;
  layouts: Layouts;
  windowWidth: number;
};

class Dashboard extends Component<Props, State> {
  constructor(props) {
    super(props);
    const {dashboard, organization} = props;
    const isUsingGrid = organization.features.includes('dashboard-grid-layout');
    const desktopLayout = getDashboardLayout(dashboard.widgets);
    this.state = {
      isMobile: false,
      layouts: {
        [DESKTOP]: isUsingGrid ? desktopLayout : [],
        [MOBILE]: isUsingGrid ? getMobileLayout(desktopLayout, dashboard.widgets) : [],
      },
      windowWidth: window.innerWidth,
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.organization.features.includes('dashboard-grid-layout')) {
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
    }
    return null;
  }

  async componentDidMount() {
    const {isEditing, organization} = this.props;
    if (organization.features.includes('dashboard-grid-layout')) {
      window.addEventListener('resize', this.debouncedHandleResize);
    }
    // Load organization tags when in edit mode.
    if (isEditing) {
      this.fetchTags();
    }
    this.addNewWidget();

    // Get member list data for issue widgets
    this.fetchMemberList();
  }

  async componentDidUpdate(prevProps: Props) {
    const {isEditing, newWidget} = this.props;

    // Load organization tags when going into edit mode.
    // We use tags on the add widget modal.
    if (prevProps.isEditing !== isEditing && isEditing) {
      this.fetchTags();
    }
    if (newWidget !== prevProps.newWidget) {
      this.addNewWidget();
    }
    if (!isEqual(prevProps.selection.projects, this.props.selection.projects)) {
      this.fetchMemberList();
    }
  }

  componentWillUnmount() {
    const {organization} = this.props;
    if (organization.features.includes('dashboard-grid-layout')) {
      window.removeEventListener('resize', this.debouncedHandleResize);
    }
  }

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
    const {api, organization, newWidget, handleAddCustomWidget} = this.props;
    if (newWidget) {
      try {
        await validateWidget(api, organization.slug, newWidget);
        handleAddCustomWidget(newWidget);
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

  handleStartAdd = () => {
    const {
      organization,
      dashboard,
      selection,
      handleUpdateWidgetList,
      handleAddCustomWidget,
    } = this.props;
    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.opened', {
      organization,
    });

    if (organization.features.includes('widget-library')) {
      trackAdvancedAnalyticsEvent('dashboards_views.widget_library.opened', {
        organization,
      });
      openAddDashboardWidgetModal({
        organization,
        dashboard,
        selection,
        onAddWidget: handleAddCustomWidget,
        onAddLibraryWidget: (widgets: Widget[]) => handleUpdateWidgetList(widgets),
        source: DashboardWidgetSource.LIBRARY,
      });
      return;
    }
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      selection,
      onAddWidget: handleAddCustomWidget,
      source: DashboardWidgetSource.DASHBOARDS,
    });
  };

  handleOpenWidgetBuilder = () => {
    const {router, paramDashboardId, organization, location} = this.props;
    if (paramDashboardId) {
      router.push({
        pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/new/`,
        query: {
          ...location.query,
          dataSet: DataSet.EVENTS,
        },
      });
      return;
    }
    router.push({
      pathname: `/organizations/${organization.slug}/dashboards/new/widget/new/`,
      query: {
        ...location.query,
        dataSet: DataSet.EVENTS,
      },
    });
  };

  handleUpdateComplete = (prevWidget: Widget) => (nextWidget: Widget) => {
    const {isEditing, handleUpdateWidgetList} = this.props;
    const nextList = [...this.props.dashboard.widgets];
    const updateIndex = nextList.indexOf(prevWidget);
    nextList[updateIndex] = {...nextWidget, tempId: prevWidget.tempId};
    this.props.onUpdate(nextList);
    if (!!!isEditing) {
      handleUpdateWidgetList(nextList);
    }
  };

  handleDeleteWidget = (widgetToDelete: Widget) => () => {
    const {dashboard, onUpdate, isEditing, handleUpdateWidgetList} = this.props;

    const nextList = dashboard.widgets.filter(widget => widget !== widgetToDelete);
    onUpdate(nextList);

    if (!!!isEditing) {
      handleUpdateWidgetList(nextList);
    }
    // Force check lazyLoad elements that might have shifted into view after deleting an upper widget
    // Unfortunately need to use setTimeout since React Grid Layout animates widgets into view when layout changes
    // RGL doesn't provide a handler for post animation layout change
    setTimeout(forceCheck, 400);
  };

  handleDuplicateWidget = (widget: Widget, index: number) => () => {
    const {dashboard, isEditing, handleUpdateWidgetList} = this.props;

    const widgetCopy = cloneDeep(widget);
    widgetCopy.id = undefined;
    widgetCopy.tempId = undefined;

    const nextList = [...dashboard.widgets];
    nextList.splice(index, 0, widgetCopy);

    if (!!!isEditing) {
      handleUpdateWidgetList(nextList);
    }
  };

  handleEditWidget = (widget: Widget, index: number) => () => {
    const {
      organization,
      dashboard,
      selection,
      router,
      location,
      paramDashboardId,
      onSetWidgetToBeUpdated,
      handleAddCustomWidget,
    } = this.props;

    if (
      organization.features.includes('metrics') &&
      organization.features.includes('metrics-dashboards-ui')
    ) {
      onSetWidgetToBeUpdated(widget);

      if (paramDashboardId) {
        router.push({
          pathname: `/organizations/${organization.slug}/dashboard/${paramDashboardId}/widget/${index}/edit/`,
          query: {
            ...location.query,
            dataSet: DataSet.EVENTS,
          },
        });
        return;
      }
      router.push({
        pathname: `/organizations/${organization.slug}/dashboards/new/widget/${index}/edit/`,
        query: {
          ...location.query,
          dataSet: DataSet.EVENTS,
        },
      });
    }

    trackAdvancedAnalyticsEvent('dashboards_views.edit_widget_modal.opened', {
      organization,
    });
    const modalProps = {
      organization,
      widget,
      selection,
      onAddWidget: handleAddCustomWidget,
      onUpdateWidget: this.handleUpdateComplete(widget),
    };
    openAddDashboardWidgetModal({
      ...modalProps,
      dashboard,
      source: DashboardWidgetSource.DASHBOARDS,
    });
  };

  getWidgetIds() {
    return [
      ...this.props.dashboard.widgets.map((widget, index): string => {
        return generateWidgetId(widget, index);
      }),
      ADD_WIDGET_BUTTON_DRAG_ID,
    ];
  }

  renderWidget(widget: Widget, index: number, defaultPosition?: Position) {
    const {isMobile, windowWidth} = this.state;
    const {isEditing, organization, widgetLimitReached, isPreview} = this.props;

    const widgetProps = {
      widget,
      isEditing,
      widgetLimitReached,
      onDelete: this.handleDeleteWidget(widget),
      onEdit: this.handleEditWidget(widget, index),
      onDuplicate: this.handleDuplicateWidget(widget, index),
      isPreview,
    };

    if (organization.features.includes('dashboard-grid-layout')) {
      const key = constructGridItemKey(widget);
      const dragId = key;
      const height = getDefaultWidgetHeight(widget.displayType);
      return (
        <GridItem
          key={key}
          data-grid={
            widget.layout ?? {
              ...defaultPosition,
              minH: height,
              w: DEFAULT_WIDGET_WIDTH,
              h: height,
            }
          }
        >
          <SortableWidget
            {...widgetProps}
            dragId={dragId}
            isMobile={isMobile}
            windowWidth={windowWidth}
          />
        </GridItem>
      );
    }

    const key = generateWidgetId(widget, index);
    const dragId = key;
    return <SortableWidget {...widgetProps} key={key} dragId={dragId} />;
  }

  renderWidgets(widgets: Widget[]) {
    const {layouts} = this.state;
    let columnDepths = calculateColumnDepths(layouts[DESKTOP]);

    return widgets.map((widget, index) => {
      if (defined(widget.layout)) {
        return this.renderWidget(widget, index);
      }

      const height = getDefaultWidgetHeight(widget.displayType);
      const [nextPosition, nextColumnDepths] = getNextAvailablePosition(
        columnDepths,
        height
      );
      columnDepths = nextColumnDepths;
      return this.renderWidget(widget, index, nextPosition);
    });
  }

  handleLayoutChange = (_, allLayouts: Layouts) => {
    const {isMobile} = this.state;
    const {dashboard, onUpdate} = this.props;
    const isNotAddButton = ({i}) => i !== ADD_WIDGET_BUTTON_DRAG_ID;
    const newLayouts = {
      [DESKTOP]: allLayouts[DESKTOP].filter(isNotAddButton),
      [MOBILE]: allLayouts[MOBILE].filter(isNotAddButton),
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
          [MOBILE]: getMobileLayout(layouts[DESKTOP], widgets),
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
      const columnDepths = calculateColumnDepths(layouts[DESKTOP]);
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

  renderGridDashboard() {
    const {layouts, isMobile} = this.state;
    const {isEditing, dashboard, organization, widgetLimitReached} = this.props;
    let {widgets} = dashboard;
    // Filter out any issue widgets if the user does not have the feature flag
    if (!organization.features.includes('issues-in-dashboards')) {
      widgets = widgets.filter(({widgetType}) => widgetType !== WidgetType.ISSUE);
    }

    const canModifyLayout = !isMobile && isEditing;

    return (
      <GridLayout
        breakpoints={BREAKPOINTS}
        cols={COLUMNS}
        rowHeight={ROW_HEIGHT}
        margin={WIDGET_MARGINS}
        draggableHandle={`.${DRAG_HANDLE_CLASS}`}
        layouts={layouts}
        onLayoutChange={this.handleLayoutChange}
        onBreakpointChange={this.handleBreakpointChange}
        isDraggable={canModifyLayout}
        isResizable={canModifyLayout}
        resizeHandle={
          <ResizeHandle
            className="react-resizable-handle"
            data-test-id="custom-resize-handle"
          >
            <IconArrow />
          </ResizeHandle>
        }
        isBounded
      >
        {this.renderWidgets(widgets)}
        {isEditing && !!!widgetLimitReached && (
          <div key={ADD_WIDGET_BUTTON_DRAG_ID} data-grid={this.addWidgetLayout}>
            <AddWidget
              orgFeatures={organization.features}
              onAddWidget={this.handleStartAdd}
              onOpenWidgetBuilder={this.handleOpenWidgetBuilder}
            />
          </div>
        )}
      </GridLayout>
    );
  }

  renderDndDashboard = () => {
    const {isEditing, onUpdate, dashboard, organization, widgetLimitReached} = this.props;
    let {widgets} = dashboard;
    // Filter out any issue widgets if the user does not have the feature flag
    if (!organization.features.includes('issues-in-dashboards')) {
      widgets = widgets.filter(({widgetType}) => widgetType !== WidgetType.ISSUE);
    }

    const items = this.getWidgetIds();

    return (
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({over, active}) => {
          const activeDragId = active.id;
          const getIndex = items.indexOf.bind(items);

          const activeIndex = activeDragId ? getIndex(activeDragId) : -1;

          if (over && over.id !== ADD_WIDGET_BUTTON_DRAG_ID) {
            const overIndex = getIndex(over.id);
            if (activeIndex !== overIndex) {
              onUpdate(arrayMove(widgets, activeIndex, overIndex));
            }
          }
        }}
      >
        <WidgetContainer>
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {widgets.map((widget, index) => this.renderWidget(widget, index))}
            {isEditing && !!!widgetLimitReached && (
              <AddWidget
                orgFeatures={organization.features}
                onAddWidget={this.handleStartAdd}
                onOpenWidgetBuilder={this.handleOpenWidgetBuilder}
              />
            )}
          </SortableContext>
        </WidgetContainer>
      </DndContext>
    );
  };

  render() {
    const {organization} = this.props;
    if (organization.features.includes('dashboard-grid-layout')) {
      return this.renderGridDashboard();
    }

    return this.renderDndDashboard();
  }
}

export default withApi(withPageFilters(Dashboard));

const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: row dense;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
`;

const GridItem = styled('div')`
  .react-resizable-handle {
    z-index: 1;
  }
`;

// HACK: to stack chart tooltips above other grid items
const GridLayout = styled(WidthProvider(Responsive))`
  margin: -${space(2)};

  .react-grid-item:hover {
    z-index: 10;
  }

  .react-resizable-handle {
    background-image: none;
  }

  .react-grid-item > .react-resizable-handle::after {
    border: none;
  }

  .react-grid-item.react-grid-placeholder {
    background: ${p => p.theme.purple200};
  }
`;

const ResizeHandle = styled('div')`
  transform: rotate(135deg);
  position: absolute;
  bottom: 2px;
  right: 4px;
`;
