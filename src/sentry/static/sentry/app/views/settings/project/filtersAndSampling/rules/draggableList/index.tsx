import React from 'react';
import {createPortal} from 'react-dom';
import {DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';

import Item, {ItemProps} from './item';
import SortableItem, {SortableItemProps} from './sortableItem';

export type UpdateItemsProps = {
  activeIndex: string;
  overIndex: string;
  reorderedItems: Array<string>;
};

type DefaultProps = Pick<
  SortableItemProps,
  'disabled' | 'wrapperStyle' | 'innerWrapperStyle'
>;

type Props = Pick<ItemProps, 'renderItem'> & {
  items: Array<string>;
  onUpdateItems: (props: UpdateItemsProps) => void;
} & DefaultProps;

type State = {
  activeId?: string;
};

class DraggableList extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    disabled: false,
    wrapperStyle: () => ({}),
    innerWrapperStyle: () => ({}),
  };

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
      disabled,
      wrapperStyle,
      innerWrapperStyle,
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
              onUpdateItems({
                activeIndex,
                overIndex,
                reorderedItems: arrayMove(items, activeIndex, overIndex),
              });
            }
          }
        }}
        onDragCancel={() => this.handleChangeActive(undefined)}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableItem
              key={item}
              id={item}
              index={index}
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
                wrapperStyle={wrapperStyle({
                  id: items[activeIndex],
                  index: activeIndex,
                  isDragging: true,
                  isSorting: false,
                })}
                innerWrapperStyle={innerWrapperStyle({
                  id: items[activeIndex],
                  index: activeIndex,
                  isSorting: activeId !== null,
                  isDragging: true,
                  overIndex: -1,
                  isDragOverlay: true,
                })}
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
