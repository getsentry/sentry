import React from 'react';
import {closestCenter, DndContext} from '@dnd-kit/core';
import {arrayMove, rectSortingStrategy, SortableContext} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import AddWidget, {ADD_WIDGET_BUTTON_DRAG_ID} from './addWidget';
import SortableWidget from './sortableWidget';
import {DashboardDetails, Widget} from './types';

type Props = {
  api: Client;
  organization: Organization;
  dashboard: DashboardDetails;
  selection: GlobalSelection;
  isEditing: boolean;
  /**
   * Fired when widgets are added/removed/sorted.
   */
  onUpdate: (widgets: Widget[]) => void;
};

class Dashboard extends React.Component<Props> {
  componentDidMount() {
    const {isEditing} = this.props;
    // Load organization tags when in edit mode.
    if (isEditing) {
      this.fetchTags();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const {isEditing} = this.props;

    // Load organization tags when going into edit mode.
    // We use tags on the add widget modal.
    if (prevProps.isEditing !== isEditing && isEditing) {
      this.fetchTags();
    }
  }

  fetchTags() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
  }

  handleStartAdd = () => {
    const {organization, dashboard, selection} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      selection,
      onAddWidget: this.handleAddComplete,
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
    const {organization, dashboard, selection} = this.props;
    openAddDashboardWidgetModal({
      organization,
      dashboard,
      widget,
      selection,
      onAddWidget: this.handleAddComplete,
      onUpdateWidget: this.handleUpdateComplete(index),
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
            {isEditing && (
              <AddWidget
                orgSlug={organization.slug}
                orgFeatures={organization.features}
                onClick={this.handleStartAdd}
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
  grid-template-columns: repeat(2, 1fr);
  grid-auto-flow: row dense;
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(6, 1fr);
  }

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    grid-template-columns: repeat(8, 1fr);
  }
`;

function generateWidgetId(widget: Widget, index: number) {
  return widget.id ? `${widget.id}-index-${index}` : `index-${index}`;
}
