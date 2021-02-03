// eslint-disable-next-line sentry/no-react-hooks
import React, {useEffect} from 'react';
import LazyLoad from 'react-lazyload';
import {DndContext} from '@dnd-kit/core';
import {SortableContext, useSortable} from '@dnd-kit/sortable';
import styled from '@emotion/styled';

import {openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import {IconAdd} from 'app/icons';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import {DashboardDetails, Widget} from './types';
import WidgetCard from './widgetCard';

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
  activeDragId: undefined | string;
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
    return this.props.dashboard.widgets.map((widget, index): string => {
      return generateWidgetId(widget, index);
    });
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
          currentWidgetDragging={this.state.activeDragId === dragId}
          onDelete={this.handleDeleteWidget(index)}
          onEdit={this.handleEditWidget(widget, index)}
        />
      </LazyLoad>
    );
  }

  render() {
    const {isEditing, dashboard} = this.props;

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
          const items = this.getWidgetIds();
          const getIndex = items.indexOf.bind(items);

          const activeIndex = activeDragId ? getIndex(activeDragId) : -1;

          if (over) {
            const overIndex = getIndex(over.id);
            if (activeIndex !== overIndex) {
              const newWidgets = [...this.props.dashboard.widgets];
              const removed = newWidgets.splice(activeIndex, 1);
              newWidgets.splice(overIndex, 0, removed[0]);
              this.props.onUpdate(newWidgets);
            }
          }

          this.setState({
            isDragging: false,
            activeDragId: undefined,
          });
        }}
        onDragCancel={() => {
          this.setState({
            isDragging: false,
            activeDragId: undefined,
          });
        }}
      >
        <WidgetContainer>
          <SortableContext items={this.getWidgetIds()}>
            {dashboard.widgets.map((widget, index) => this.renderWidget(widget, index))}
          </SortableContext>
          {isEditing && (
            <WidgetWrapper key="add" displayType="big_number">
              <AddWidgetWrapper
                key="add"
                data-test-id="widget-add"
                onClick={this.handleStartAdd}
              >
                <IconAdd size="lg" isCircled color="inactive" />
              </AddWidgetWrapper>
            </WidgetWrapper>
          )}
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

const WidgetWrapper = styled('div')<{displayType: Widget['displayType']}>`
  position: relative;
  /* Min-width prevents grid items from stretching the grid */
  min-width: 200px;

  transform: translate3d(var(--translate-x, 0), var(--translate-y, 0), 0)
    scaleX(var(--scale-x, 1)) scaleY(var(--scale-y, 1));
  transform-origin: 0 0;
  touch-action: manipulation;

  ${p => {
    switch (p.displayType) {
      case 'big_number':
        return 'grid-area: span 1 / span 1;';
      default:
        return 'grid-area: span 2 / span 2;';
    }
  }};
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

type SortableWidgetProps = {
  widget: Widget;
  dragId: string;
  isEditing: boolean;
  isDragging: boolean;
  currentWidgetDragging: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

function SortableWidget(props: SortableWidgetProps) {
  const {
    widget,
    dragId,
    isDragging,
    currentWidgetDragging,
    isEditing,
    onDelete,
    onEdit,
  } = props;

  useEffect(() => {
    if (!currentWidgetDragging) {
      return undefined;
    }

    document.body.style.cursor = 'grabbing';

    return function cleanup() {
      document.body.style.cursor = '';
    };
  }, [currentWidgetDragging]);

  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({
    id: dragId,
  });

  const style = {
    zIndex: currentWidgetDragging ? theme.zIndex.modal : 0,
    transition,
    '--translate-x': transform ? `${Math.round(transform.x)}px` : undefined,
    '--translate-y': transform ? `${Math.round(transform.y)}px` : undefined,
    // Never scale up widgets (e.g. don't resize Big Number to a World Map)
    '--scale-x':
      transform?.scaleX && transform.scaleX <= 1 ? `${transform.scaleX}` : undefined,
    '--scale-y':
      transform?.scaleY && transform.scaleY <= 1 ? `${transform.scaleY}` : undefined,
  } as React.CSSProperties;

  return (
    <WidgetWrapper
      ref={setNodeRef}
      style={isDragging ? style : {}}
      displayType={widget.displayType}
    >
      <WidgetCard
        widget={widget}
        isEditing={isEditing}
        onDelete={onDelete}
        onEdit={onEdit}
        isDragging={isDragging}
        hideToolbar={isDragging}
        currentWidgetDragging={currentWidgetDragging}
        draggableProps={{
          attributes,
          listeners,
        }}
      />
    </WidgetWrapper>
  );
}

function generateWidgetId(widget: Widget, index: number) {
  return widget.id ?? `index-${index}`;
}
