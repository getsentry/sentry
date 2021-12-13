import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Component} from 'react';
import {Layout, Responsive, WidthProvider} from 'react-grid-layout';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import sortBy from 'lodash/sortBy';
import zip from 'lodash/zip';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  openAddDashboardIssueWidgetModal,
  openAddDashboardWidgetModal,
} from 'sentry/actionCreators/modal';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import {GlobalSelection, Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {uniqueId} from 'sentry/utils/guid';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';
import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from 'sentry/views/dashboardsV2/addWidget';
import {
  DashboardDetails,
  DashboardWidgetSource,
  DisplayType,
  MAX_WIDGETS,
  Widget,
  WidgetType,
} from 'sentry/views/dashboardsV2/types';
import {DataSet} from 'sentry/views/dashboardsV2/widget/utils';

import SortableWidget from './sortableWidget';

export const DRAG_HANDLE_CLASS = 'widget-drag';
const WIDGET_PREFIX = 'grid-item';
const NUM_COLS = 6;
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
const MOBILE_BREAKPOINT = 700;

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: GlobalSelection;
  isEditing: boolean;
  router: InjectedRouter;
  location: Location;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
  onSetWidgetToBeUpdated: (widget: Widget) => void;
  paramDashboardId?: string;
  newWidget?: Widget;
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
};

type State = {
  breakpoint: string;
};

class Dashboard extends Component<Props, State> {
  state = {
    breakpoint: 'desktop',
  };

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
    const {organization, dashboard, selection} = this.props;

    trackAdvancedAnalyticsEvent('dashboards_views.add_widget_modal.opened', {
      organization,
    });
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
    if (widget.widgetType === WidgetType.ISSUE) {
      openAddDashboardIssueWidgetModal(modalProps);
    } else {
      openAddDashboardWidgetModal({
        ...modalProps,
        dashboard,
        source: DashboardWidgetSource.DASHBOARDS,
      });
    }
  };

  renderWidget(widget: Widget, index: number) {
    const {breakpoint} = this.state;
    const {isEditing} = this.props;

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
          hideDragHandle={breakpoint === 'mobile'}
        />
      </GridItem>
    );
  }

  onLayoutChange = newLayout => {
    const {onLayoutChange} = this.props;
    // HACK: Disable layout change when element is less than mobile width
    const rect = document.querySelector('.react-grid-layout')?.getBoundingClientRect();
    if (rect && rect.width <= MOBILE_BREAKPOINT) {
      this.setState({breakpoint: 'mobile'});
      return;
    }

    this.setState({breakpoint: 'desktop'});

    const isNotAddButton = ({i}) => i !== ADD_WIDGET_BUTTON_DRAG_ID;
    onLayoutChange(newLayout.filter(isNotAddButton));
  };

  render() {
    const {
      isEditing,
      dashboard: {widgets},
      organization,
      layout,
    } = this.props;

    const canModifyLayout = this.state.breakpoint === 'desktop' && isEditing;

    return (
      <GridLayout
        breakpoints={{mobile: 0, desktop: MOBILE_BREAKPOINT}}
        cols={{mobile: 2, desktop: 6}}
        rowHeight={ROW_HEIGHT}
        margin={WIDGET_MARGINS}
        draggableHandle={`.${DRAG_HANDLE_CLASS}`}
        layouts={{desktop: layout, mobile: getMobileLayout(layout, widgets)}}
        onLayoutChange={this.onLayoutChange}
        isDraggable={canModifyLayout}
        isResizable={canModifyLayout}
        isBounded
      >
        {widgets.map((widget, index) => this.renderWidget(widget, index))}
        {isEditing && widgets.length < MAX_WIDGETS && (
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
    x: (DEFAULT_WIDGET_WIDTH * index) % NUM_COLS,
    y: Number.MAX_VALUE,
    w: DEFAULT_WIDGET_WIDTH,
    h: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
    minH: displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  };
}

function getMobileLayout(desktopLayout, widgets) {
  const layoutWidgetPairs = zip(desktopLayout, widgets);

  // Sort by y and then subsort by x
  const sorted = sortBy(layoutWidgetPairs, ['0.y', '0.x']) as [Layout, Widget][];

  const mobileLayout = sorted.map(([layout, widget], index) => ({
    ...layout,
    x: 0,
    y: index * 2,
    w: 2,
    // TODO: Kind of a hack because when you delete a widget
    // and zip, the mismatched lengths creates undefined values
    h: widget?.displayType === DisplayType.BIG_NUMBER ? 1 : 2,
  }));

  return mobileLayout;
}
