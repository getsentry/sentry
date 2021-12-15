import {Component} from 'react';
import {InjectedRouter} from 'react-router';
import {closestCenter, DndContext} from '@dnd-kit/core';
import {arrayMove, rectSortingStrategy, SortableContext} from '@dnd-kit/sortable';
import styled from '@emotion/styled';
import {Location} from 'history';

import {validateWidget} from 'sentry/actionCreators/dashboards';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  openAddDashboardWidgetModal,
  openDashboardWidgetLibraryModal,
} from 'sentry/actionCreators/modal';
import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import space from 'sentry/styles/space';
import {GlobalSelection, Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withApi from 'sentry/utils/withApi';
import withGlobalSelection from 'sentry/utils/withGlobalSelection';

import {DataSet} from './widget/utils';
import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from './addWidget';
import SortableWidget from './sortableWidget';
import {DashboardDetails, DashboardWidgetSource, MAX_WIDGETS, Widget} from './types';

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
  handleAddLibraryWidgets: (widgets: Widget[]) => void;
  paramDashboardId?: string;
  newWidget?: Widget;
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

  renderWidget(widget: Widget, index: number) {
    const {isEditing} = this.props;

    const key = generateWidgetId(widget, index);
    const dragId = key;

    return (
      <SortableWidget
        key={key}
        widget={widget}
        dragId={dragId}
        isEditing={isEditing}
        onDelete={this.handleDeleteWidget(index)}
        onEdit={this.handleEditWidget(widget, index)}
      />
    );
  }

  render() {
    const {
      isEditing,
      onUpdate,
      dashboard: {widgets},
      organization,
    } = this.props;

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
            {isEditing && widgets.length < MAX_WIDGETS && (
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
  }
}

export default withApi(withGlobalSelection(Dashboard));

const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: row dense;
  grid-gap: ${space(2)};

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

function generateWidgetId(widget: Widget, index: number) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
}
