import 'react-grid-layout/css/styles.css';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Layout} from 'react-grid-layout';
import {Responsive, WidthProvider} from 'react-grid-layout';
import {forceCheck} from 'react-lazyload';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Button} from 'sentry/components/core/button';
import {IconResize} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DatasetSource} from 'sentry/utils/discover/types';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';
import {trackEngagementAnalytics} from 'sentry/views/dashboards/widgetBuilder/utils/trackEngagementAnalytics';

import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from './addWidget';
import type {Position} from './layoutUtils';
import {
  assignDefaultLayout,
  assignTempId,
  calculateColumnDepths,
  constructGridItemKey,
  DEFAULT_WIDGET_WIDTH,
  generateWidgetsAfterCompaction,
  getDashboardLayout,
  getDefaultWidgetHeight,
  getMobileLayout,
  getNextAvailablePosition,
  pickDefinedStoreKeys,
} from './layoutUtils';
import SortableWidget from './sortableWidget';
import type {DashboardDetails, Widget} from './types';
import {WidgetType} from './types';
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
const MOBILE_BREAKPOINT = (theme: Theme) => parseInt(theme.breakpoints.sm, 10);
const BREAKPOINTS = (theme: Theme) => ({
  [MOBILE]: 0,
  [DESKTOP]: MOBILE_BREAKPOINT(theme),
});
const COLUMNS = {[MOBILE]: NUM_MOBILE_COLS, [DESKTOP]: NUM_DESKTOP_COLS};
export const DASHBOARD_CHART_GROUP = 'dashboard-group';

type Props = {
  dashboard: DashboardDetails;
  handleAddCustomWidget: (widget: Widget) => void;
  handleUpdateWidgetList: (widgets: Widget[]) => void;
  isEditingDashboard: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
  widgetLegendState: WidgetLegendSelectionState;
  widgetLimitReached: boolean;
  handleChangeSplitDataset?: (widget: Widget, index: number) => void;
  isPreview?: boolean;
  newWidget?: Widget;
  newlyAddedWidget?: Widget;
  onAddWidget?: (dataset: DataSet, openWidgetTemplates?: boolean) => void;
  onEditWidget?: (widget: Widget) => void;
  onNewWidgetScrollComplete?: () => void;
  onSetNewWidget?: () => void;
};

interface LayoutState extends Record<string, Layout[]> {
  [DESKTOP]: Layout[];
  [MOBILE]: Layout[];
}

function Dashboard({
  dashboard,
  handleAddCustomWidget,
  handleUpdateWidgetList,
  isEditingDashboard,
  onUpdate,
  widgetLegendState,
  widgetLimitReached,
  isPreview,
  newWidget,
  newlyAddedWidget,
  onAddWidget,
  onEditWidget,
  onNewWidgetScrollComplete,
  onSetNewWidget,
}: Props) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const api = useApi();
  const {selection} = usePageFilters();
  const [layouts, setLayouts] = useState<LayoutState>(() => {
    const desktopLayout = getDashboardLayout(dashboard.widgets);
    return {
      [DESKTOP]: desktopLayout,
      [MOBILE]: getMobileLayout(desktopLayout, dashboard.widgets),
    };
  });
  const [isMobile, setIsMobile] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const forceCheckTimeout = useRef<number | undefined>(undefined);

  const debouncedHandleResize = useCallback(
    () =>
      debounce(() => {
        setWindowWidth(window.innerWidth);
      }, 250),
    []
  );

  const addNewWidget = useCallback(async () => {
    if (newWidget) {
      try {
        await validateWidget(api, organization.slug, newWidget);
        handleAddCustomWidget(newWidget);
        onSetNewWidget?.();
      } catch (error: any) {
        // Don't do anything, widget isn't valid
        addErrorMessage(error);
      }
    }
  }, [newWidget, handleAddCustomWidget, onSetNewWidget, api, organization.slug]);

  const fetchMemberList = useCallback(() => {
    // Stores MemberList in MemberListStore for use in modals and sets state for use is child components
    fetchOrgMembers(
      api,
      organization.slug,
      selection.projects?.map(projectId => String(projectId))
    );
  }, [api, organization.slug, selection.projects]);

  useEffect(() => {
    window.addEventListener('resize', debouncedHandleResize);

    // Always load organization tags on dashboards
    loadOrganizationTags(api, organization.slug, selection);

    if (newWidget) {
      addNewWidget();
    }

    // Get member list data for issue widgets
    fetchMemberList();

    connectDashboardCharts(DASHBOARD_CHART_GROUP);
    trackEngagementAnalytics(dashboard.widgets, organization, dashboard.title);

    return () => {
      window.removeEventListener('resize', debouncedHandleResize);
      window.clearTimeout(forceCheckTimeout.current);
      GroupStore.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // The operations in this effect should only run on mount/unmount

  // Handle layout updates when dashboard widgets change (replaces getDerivedStateFromProps)
  useEffect(() => {
    if (isMobile) {
      // Don't need to recalculate any layout state from props in the mobile view
      // because we want to force different positions (i.e. new widgets added
      // at the bottom)
      return;
    }

    // If the user clicks "Cancel" and the dashboard resets,
    // recalculate the layout to revert to the unmodified state
    const dashboardLayout = getDashboardLayout(dashboard.widgets);
    const currentDesktopLayout = layouts[DESKTOP].map(pickDefinedStoreKeys);
    const newDesktopLayout = dashboardLayout.map(pickDefinedStoreKeys);

    // Only update if layouts are actually different
    let layoutsAreDifferent = false;
    if (currentDesktopLayout.length === newDesktopLayout.length) {
      for (let i = 0; i < currentDesktopLayout.length; i++) {
        const current = currentDesktopLayout[i];
        const newLayout = newDesktopLayout[i];
        if (
          !current ||
          !newLayout ||
          current.x !== newLayout.x ||
          current.y !== newLayout.y ||
          current.w !== newLayout.w ||
          current.h !== newLayout.h
        ) {
          layoutsAreDifferent = true;
          break;
        }
      }
    } else {
      layoutsAreDifferent = true;
    }

    if (layoutsAreDifferent) {
      setLayouts({
        [DESKTOP]: dashboardLayout,
        [MOBILE]: getMobileLayout(dashboardLayout, dashboard.widgets),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.widgets, isMobile]); // TODO(nar): Don't include layouts to avoid infinite loop

  // Handle newWidget and selection.projects changes (replaces componentDidUpdate)
  useEffect(() => {
    if (newWidget) {
      addNewWidget();
    }
  }, [newWidget, addNewWidget]);

  useEffect(() => {
    fetchMemberList();
  }, [fetchMemberList]);

  const handleDeleteWidget = useCallback(
    (widgetToDelete: Widget) => () => {
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
    },
    [organization, dashboard, onUpdate, isEditingDashboard, handleUpdateWidgetList]
  );

  const handleDuplicateWidget = useCallback(
    (widget: Widget) => () => {
      trackAnalytics('dashboards_views.widget.duplicate', {
        organization,
        widget_type: widget.displayType,
      });

      const widgetCopy = cloneDeep(
        assignTempId({...widget, id: undefined, tempId: undefined})
      );

      let nextList = [...dashboard.widgets, widgetCopy];
      nextList = generateWidgetsAfterCompaction(nextList);

      onUpdate(nextList);
      if (!isEditingDashboard) {
        handleUpdateWidgetList(nextList);
      }
    },
    [organization, dashboard, onUpdate, isEditingDashboard, handleUpdateWidgetList]
  );

  const handleEditWidget = useCallback(
    (index: number) => () => {
      const widget = dashboard.widgets[index]!;

      trackAnalytics('dashboards_views.widget.edit', {
        organization,
        widget_type: widget.displayType,
      });

      if (widget.widgetType === WidgetType.METRICS) {
        return;
      }

      onEditWidget?.(widget);
      return;
    },
    [organization, dashboard, onEditWidget]
  );

  const handleChangeSplitDataset = useCallback(
    (widget: Widget, index: number) => {
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
    },
    [dashboard, onUpdate, isEditingDashboard, handleUpdateWidgetList]
  );

  const renderWidget = (widget: Widget, index: number) => {
    const widgetProps = {
      widget,
      widgetLegendState,
      isEditingDashboard,
      widgetLimitReached,
      onDelete: handleDeleteWidget(widget),
      onEdit: handleEditWidget(index),
      onDuplicate: handleDuplicateWidget(widget),
      onSetTransactionsDataset: () => handleChangeSplitDataset(widget, index),
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
          newlyAddedWidget={newlyAddedWidget}
          onNewWidgetScrollComplete={onNewWidgetScrollComplete}
        />
      </div>
    );
  };

  const handleLayoutChange = useCallback(
    (_: any, allLayouts: LayoutState) => {
      const isNotAddButton = ({i}: any) => i !== ADD_WIDGET_BUTTON_DRAG_ID;
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

      setLayouts(newLayouts);
      onUpdate(newWidgets);

      // Force check lazyLoad elements that might have shifted into view after (re)moving an upper widget
      // Unfortunately need to use window.setTimeout since React Grid Layout animates widgets into view when layout changes
      // RGL doesn't provide a handler for post animation layout change
      window.clearTimeout(forceCheckTimeout.current);
      forceCheckTimeout.current = window.setTimeout(forceCheck, 400);
    },
    [dashboard.widgets, isMobile, onUpdate]
  );

  const handleBreakpointChange = useCallback(
    (newBreakpoint: string) => {
      const {widgets} = dashboard;

      if (newBreakpoint === MOBILE) {
        setIsMobile(true);
        setLayouts({
          ...layouts,
          [MOBILE]: getMobileLayout(layouts[DESKTOP], widgets),
        });
        return;
      }
      setIsMobile(false);
    },
    [layouts, dashboard]
  );

  const addWidgetLayout = useMemo(() => {
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
  }, [layouts, isMobile]);

  const columnDepths = calculateColumnDepths(layouts[DESKTOP]);
  const widgetsWithLayout = assignDefaultLayout(dashboard.widgets, columnDepths);
  const canModifyLayout = !isMobile && isEditingDashboard;

  return (
    <GridLayout
      breakpoints={BREAKPOINTS(theme)}
      cols={COLUMNS}
      rowHeight={ROW_HEIGHT}
      margin={WIDGET_MARGINS}
      draggableHandle={`.${DRAG_HANDLE_CLASS}`}
      draggableCancel={`.${DRAG_RESIZE_CLASS}`}
      layouts={layouts}
      onLayoutChange={handleLayoutChange}
      onBreakpointChange={handleBreakpointChange}
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
      {widgetsWithLayout.map((widget, index) => renderWidget(widget, index))}
      {isEditingDashboard && !widgetLimitReached && !isPreview && (
        <AddWidgetWrapper key={ADD_WIDGET_BUTTON_DRAG_ID} data-grid={addWidgetLayout}>
          <AddWidget onAddWidget={onAddWidget} />
        </AddWidgetWrapper>
      )}
    </GridLayout>
  );
}

export default Dashboard;

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
