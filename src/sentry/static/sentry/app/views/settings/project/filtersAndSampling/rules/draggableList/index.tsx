import React from 'react';
import {createPortal} from 'react-dom';
import {DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';

import Item, {ItemProps} from './item';
import SortableItem, {SortableItemProps} from './sortableItem';

type Props = Pick<ItemProps, 'renderItem' | 'innerWrapperStyle' | 'wrapperStyle'> &
  Pick<SortableItemProps, 'disabled'> & {
    items: Array<string>;
    onUpdateItems: (items: Array<string>) => void;
  };

type State = {
  activeId?: string;
};

class DraggableList extends React.Component<Props, State> {
  state: State = {};

  handleChangeActive = (activeId: State['activeId']) => {
    this.setState({activeId});
  };

  render() {
    const {activeId} = this.state;
    const {
      items,
      onUpdateItems,
      renderItem,
      wrapperStyle,
      innerWrapperStyle,
      disabled,
    } = this.props;

    const getIndex = items.indexOf.bind(items);
    const activeIndex = activeId ? getIndex(activeId) : -1;

    return (
      <DndContext
        onDragStart={({active}) => {
          if (!active) {
            return;
          }

          this.handleChangeActive(active.id);
        }}
        onDragEnd={({over}) => {
          this.handleChangeActive(undefined);

          if (over) {
            const overIndex = getIndex(over.id);
            if (activeIndex !== overIndex) {
              onUpdateItems(arrayMove(items, activeIndex, overIndex));
            }
          }
        }}
        onDragCancel={() => this.handleChangeActive(undefined)}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableItem
              key={item}
              id={item}
              renderItem={renderItem}
              disabled={disabled}
              wrapperStyle={wrapperStyle}
              innerWrapperStyle={innerWrapperStyle}
            />
          ))}
        </SortableContext>
        {createPortal(
          <DragOverlay>
            {activeId ? (
              <Item
                value={items[activeIndex]}
                renderItem={renderItem}
                wrapperStyle={wrapperStyle}
                innerWrapperStyle={innerWrapperStyle}
                style={{cursor: disabled ? undefined : 'grabbing'}}
              />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    );
  }
}

export default DraggableList;
export {ItemProps, SortableItemProps};
