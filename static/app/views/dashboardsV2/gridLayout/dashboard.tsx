import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import {Component} from 'react';
import RGL, {Layout, WidthProvider} from 'react-grid-layout';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

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

const GridLayout = WidthProvider(RGL);

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

  // TODO(nar): optional to maintain compatiblity with old dashboard types
  layout?: Layout[];
  onLayoutChange?: (layout: Layout[]) => void;
};

class Dashboard extends Component<Props> {
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
    this.props.onUpdate([...this.props.dashboard.widgets, widget]);
  };

  handleUpdateComplete = (index: number) => (nextWidget: Widget) => {
    const nextList = [...this.props.dashboard.widgets];
    nextList[index] = nextWidget;
    this.props.onUpdate(nextList);
  };

  handleDeleteWidget = (index: number) => () => {
    const nextList = [...this.props.dashboard.widgets];
    nextList.splice(index, 1);
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
      onUpdateWidget: this.handleUpdateComplete(index),
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
    const {isEditing} = this.props;

    const key = generateWidgetId(widget, index);
    const dragId = key;

    return (
      <GridItem key={key} data-grid={getDefaultPosition(index, widget.displayType)}>
        <SortableWidget
          widget={widget}
          dragId={dragId}
          isEditing={isEditing}
          onDelete={this.handleDeleteWidget(index)}
          onEdit={this.handleEditWidget(widget, index)}
        />
      </GridItem>
    );
  }

  render() {
    const {
      isEditing,
      dashboard: {widgets},
      organization,
      layout,
      onLayoutChange,
    } = this.props;

    return (
      <GridLayout
        cols={NUM_COLS}
        rowHeight={ROW_HEIGHT}
        margin={WIDGET_MARGINS}
        draggableHandle={`.${DRAG_HANDLE_CLASS}`}
        layout={layout}
        onLayoutChange={onLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
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

function generateWidgetId(widget: Widget, index: number) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
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
