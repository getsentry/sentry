import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Component} from 'react';
import {Layout, Layouts, Responsive, WidthProvider} from 'react-grid-layout';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  openAddDashboardWidgetModal,
  openDashboardWidgetLibraryModal,
} from 'sentry/actionCreators/modal';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import {GlobalSelection, Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {uniqueId} from 'sentry/utils/guid';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from 'sentry/views/dashboardsV2/addWidget';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import {DataSet} from 'sentry/views/dashboardsV2/widget/utils';

import SortableWidget from './sortableWidget';

export const DRAG_HANDLE_CLASS = 'widget-drag';
const WIDGET_PREFIX = 'grid-item';
const DESKTOP = 'desktop';
const MOBILE = 'mobile';
const NUM_DESKTOP_COLS = 6;
const NUM_MOBILE_COLS = 2;
const ROW_HEIGHT = 120;
const WIDGET_MARGINS: [number, number] = [16, 16];
const ADD_BUTTON_POSITION = {
  x: 0,
  y: Number.MAX_VALUE,
  w: 2,
  h: 1,
  isResizable: false,
};
const DEFAULT_WIDGET_WIDTH = 2;
const MOBILE_BREAKPOINT = parseInt(theme.breakpoints[0], 10);
const BREAKPOINTS = {[MOBILE]: 0, [DESKTOP]: MOBILE_BREAKPOINT};
const COLUMNS = {[MOBILE]: NUM_MOBILE_COLS, [DESKTOP]: NUM_DESKTOP_COLS};

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: GlobalSelection;
  isEditing: boolean;
  router: InjectedRouter;
  location: Location;
  widgetLimitReached: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
  onSetWidgetToBeUpdated: (widget: Widget) => void;
  handleAddLibraryWidgets: (widgets: Widget[]) => void;
  paramDashboardId?: string;
  newWidget?: Widget;
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
};

type State = {
  isMobile: boolean;
  layouts: Layouts;
};

class Dashboard extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      isMobile: false,
      layouts: {
        [DESKTOP]: props.layout,
        [MOBILE]: getMobileLayout(props.layout, props.dashboard.widgets),
      },
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (!isEqual(props.layout, state.layouts[DESKTOP])) {
      return {
        ...state,
        layouts: {
          [DESKTOP]: props.layout,
          [MOBILE]: getMobileLayout(props.layout, props.dashboard.widgets),
        },
      };
    }
    return null;
  }

  async componentDidMount() {
    const {isEditing} = this.props;
    // Load organization tags when in edit mode.
    if (isEditing) {
      this.fetchTags();
    }
    this.addNewWidget();
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
  }

  async addNewWidget() {
    const {api, organization, newWidget} = this.props;
    if (newWidget) {
      try {
        await validateWidget(api, organization.slug, newWidget);
        this.handleAddComplete(newWidget);
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
    const {organization, dashboard, selection, handleAddLibraryWidgets} = this.props;

    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.opened', {
      organization,
    });
    if (organization.features.includes('widget-library')) {
      openDashboardWidgetLibraryModal({
        organization,
        dashboard,
        onAddWidget: (widgets: Widget[]) => handleAddLibraryWidgets(widgets),
      });
      return;
    }
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      selection,
      onAddWidget: this.handleAddComplete,
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

  handleAddComplete = (widget: Widget) => {
    this.props.onUpdate([...this.props.dashboard.widgets, assignTempId(widget)]);
  };

  handleUpdateComplete = (prevWidget: Widget) => (nextWidget: Widget) => {
    const nextList = [...this.props.dashboard.widgets];
    const updateIndex = nextList.indexOf(prevWidget);
    nextList[updateIndex] = {...nextWidget, tempId: prevWidget.tempId};
    this.props.onUpdate(nextList);
  };

  handleDeleteWidget = (widgetToDelete: Widget) => () => {
    const nextList = this.props.dashboard.widgets.filter(
      widget => widget !== widgetToDelete
    );
    this.props.onUpdate(nextList);
  };

  handleDuplicateWidget = (widget: Widget, index: number) => () => {
    const {dashboard, handleAddLibraryWidgets} = this.props;

    const widgetCopy = cloneDeep(widget);
    widgetCopy.id = undefined;
    widgetCopy.tempId = undefined;

    const nextList = [...dashboard.widgets];
    nextList.splice(index, 0, widgetCopy);

    handleAddLibraryWidgets(nextList);
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
    } = this.props;

    if (organization.features.includes('metrics')) {
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
      onAddWidget: this.handleAddComplete,
      onUpdateWidget: this.handleUpdateComplete(widget),
    };
    openAddDashboardWidgetModal({
      ...modalProps,
      dashboard,
      source: DashboardWidgetSource.DASHBOARDS,
    });
  };

  renderWidget(widget: Widget, index: number) {
    const {isMobile} = this.state;
    const {isEditing, widgetLimitReached} = this.props;

    const key = constructGridItemKey(widget);
    const dragId = key;

    return (
      <GridItem key={key} data-grid={getDefaultPosition(index, widget.displayType)}>
        <SortableWidget
          widget={widget}
          dragId={dragId}
          isEditing={isEditing}
          onDelete={this.handleDeleteWidget(widget)}
          onEdit={this.handleEditWidget(widget, index)}
          hideDragHandle={isMobile}
          onDuplicate={this.handleDuplicateWidget(widget, index)}
          widgetLimitReached={widgetLimitReached}
        />
      </GridItem>
    );
  }

  onLayoutChange = (_, allLayouts) => {
    const {onLayoutChange} = this.props;
    const isNotAddButton = ({i}) => i !== ADD_WIDGET_BUTTON_DRAG_ID;
    const newLayouts = {
      [DESKTOP]: allLayouts[DESKTOP].filter(isNotAddButton),
      [MOBILE]: allLayouts[MOBILE].filter(isNotAddButton),
    };
    this.setState({
      layouts: newLayouts,
    });

    // The desktop layout is the source of truth
    onLayoutChange(newLayouts[DESKTOP]);
  };

  onBreakpointChange = newBreakpoint => {
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

  render() {
    const {layouts, isMobile} = this.state;
    const {
      isEditing,
      dashboard: {widgets},
      organization,
      widgetLimitReached,
    } = this.props;

    const canModifyLayout = !isMobile && isEditing;

    return (
      <GridLayout
        breakpoints={BREAKPOINTS}
        cols={COLUMNS}
        rowHeight={ROW_HEIGHT}
        margin={WIDGET_MARGINS}
        draggableHandle={`.${DRAG_HANDLE_CLASS}`}
        layouts={layouts}
        onLayoutChange={this.onLayoutChange}
        onBreakpointChange={this.onBreakpointChange}
        isDraggable={canModifyLayout}
        isResizable={canModifyLayout}
        isBounded
      >
        {widgets.map((widget, index) => this.renderWidget(widget, index))}
        {isEditing && !!!widgetLimitReached && (
          <div key={ADD_WIDGET_BUTTON_DRAG_ID} data-grid={ADD_BUTTON_POSITION}>
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
}

export default withApi(withGlobalSelection(Dashboard));

const GridItem = styled('div')`
  .react-resizable-handle {
    z-index: 1;
  }
`;

// HACK: to stack chart tooltips above other grid items
const GridLayout = styled(WidthProvider(Responsive))`
  .react-grid-item:hover {
    z-index: 10;
  }
`;

export function constructGridItemKey(widget: Widget) {
  return `${WIDGET_PREFIX}-${widget.id ?? widget.tempId}`;
}

export function assignTempId(widget) {
  if (widget.id ?? widget.tempId) {
    return widget;
  }

  return {...widget, tempId: uniqueId()};
}

/**
 * Naive positioning for widgets assuming no resizes.
 */
function getDefaultPosition(index: number, displayType: DisplayType) {
  return {
    x: (DEFAULT_WIDGET_WIDTH * index) % NUM_DESKTOP_COLS,
    y: Number.MAX_VALUE,
    w: DEFAULT_WIDGET_WIDTH,
    h: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
    minH: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  };
}

function getMobileLayout(desktopLayout, widgets) {
  if (desktopLayout.length === 0) {
    // Initial case where the user has no layout saved, but
    // dashboard has widgets
    return [];
  }

  // Filter out layouts to only those that haven't been deleted
  const expectedGridKeys = new Set(widgets.map(constructGridItemKey));
  const survivingLayouts = desktopLayout.filter(({i}) => expectedGridKeys.has(i));

  const layoutWidgetPairs = zip(survivingLayouts, widgets);

  // Sort by y and then subsort by x
  const sorted = sortBy(layoutWidgetPairs, ['0.y', '0.x']) as [Layout, Widget][];

  const mobileLayout = sorted.map(([layout, widget], index) => ({
    ...layout,
    x: 0,
    y: index * 2,
    w: 2,
    h: widget.displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  }));

  return mobileLayout;
}
