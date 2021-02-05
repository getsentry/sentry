import React from 'react';
import LazyLoad from 'react-lazyload';
import {DndContext} from '@dnd-kit/core';
import {rectSwappingStrategy, SortableContext, useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import {IconAdd} from 'app/icons';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import SortableWidget from './sortableWidget';
import {WidgetWrapper} from './styles';
import {DashboardDetails, Widget} from './types';

const ADD_WIDGET_BUTTON_DRAG_ID = 'add-widget-button';
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

type State = {
  isDragging: boolean;
  activeDragId?: string;
};

class Dashboard extends React.Component<Props, State> {
  state: State = {
    activeDragId: undefined,
    isDragging: false,
  };

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
      <LazyLoad key={key} once height={240} offset={100}>
        <SortableWidget
          widget={widget}
          dragId={dragId}
          isEditing={isEditing}
          isDragging={this.state.isDragging}
          onDelete={this.handleDeleteWidget(index)}
          onEdit={this.handleEditWidget(widget, index)}
        />
      </LazyLoad>
    );
  }

  resetDragState() {
    this.setState({
      isDragging: false,
      activeDragId: undefined,
    });
  }

  render() {
    const {
      isEditing,
      onUpdate,
      dashboard: {widgets},
    } = this.props;

    const items = this.getWidgetIds();

    return (
      <DndContext
        onDragStart={({active}) => {
          if (!active) {
            return;
          }

          this.setState({
            isDragging: true,
            activeDragId: active.id,
          });
        }}
        onDragEnd={({over}) => {
          const {activeDragId} = this.state;
          const getIndex = items.indexOf.bind(items);

          const activeIndex = activeDragId ? getIndex(activeDragId) : -1;

          if (over && over.id !== ADD_WIDGET_BUTTON_DRAG_ID) {
            const overIndex = getIndex(over.id);
            if (activeIndex !== overIndex) {
              const newWidgets = [...widgets];
              const removed = newWidgets.splice(activeIndex, 1);
              newWidgets.splice(overIndex, 0, removed[0]);
              onUpdate(newWidgets);
            }
          }

          this.resetDragState();
        }}
        onDragCancel={this.resetDragState}
      >
        <WidgetContainer>
          <SortableContext items={items} strategy={rectSwappingStrategy}>
            {widgets.map((widget, index) => this.renderWidget(widget, index))}
            {isEditing && <AddWidget onClick={this.handleStartAdd} />}
          </SortableContext>
        </WidgetContainer>
      </DndContext>
    );
  }
}

export default withApi(withGlobalSelection(Dashboard));

const WidgetContainer = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-flow: row dense;
  grid-gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr;
  }
`;

const AddWidgetWrapper = styled('a')`
  width: 100%;
  height: 110px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  justify-content: center;
`;

function AddWidget(props: {onClick: () => void}) {
  const {onClick} = props;

  const initialStyles = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 0,
  };

  const {setNodeRef, transform} = useSortable({
    disabled: true,
    id: ADD_WIDGET_BUTTON_DRAG_ID,
    transition: null,
  });

  return (
    <WidgetWrapper
      key="add"
      ref={setNodeRef}
      displayType="big_number"
      layoutId={ADD_WIDGET_BUTTON_DRAG_ID}
      animate={
        transform
          ? {
              x: transform.x,
              y: transform.y,
              scaleX: transform?.scaleX && transform.scaleX <= 1 ? transform.scaleX : 1,
              scaleY: transform?.scaleY && transform.scaleY <= 1 ? transform.scaleY : 1,
            }
          : initialStyles
      }
      transition={{
        duration: 0,
        easings: {
          type: 'spring',
        },
        transform: {duration: 0},
        scale: {
          duration: 0.25,
        },
      }}
    >
      <AddWidgetWrapper key="add" data-test-id="widget-add" onClick={onClick}>
        <IconAdd size="lg" isCircled color="inactive" />
      </AddWidgetWrapper>
    </WidgetWrapper>
  );
}

function generateWidgetId(widget: Widget, index: number) {
  return widget.id ?? `index-${index}`;
}
