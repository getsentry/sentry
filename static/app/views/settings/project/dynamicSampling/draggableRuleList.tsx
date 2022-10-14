import {useState} from 'react';
import {createPortal} from 'react-dom';
import {DndContext, DragOverlay} from '@dnd-kit/core';
import {arrayMove, SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';

import {SamplingRule} from 'sentry/types/sampling';

import {DraggableRuleListItem, DraggableRuleListItemProps} from './draggableRuleListItem';
import {
  DraggableRuleListSortableItem,
  SortableItemProps,
} from './draggableRuleListSortableItem';
import {isUniformRule} from './utils';

export type DraggableRuleListUpdateItemsProps = {
  activeIndex: string;
  overIndex: string;
  reorderedItems: Array<string>;
};

type Props = Pick<SortableItemProps, 'disabled' | 'wrapperStyle'> &
  Pick<DraggableRuleListItemProps, 'renderItem'> & {
    items: Array<
      Omit<SamplingRule, 'id'> & {
        id: string;
      }
    >;
    onUpdateItems: (props: DraggableRuleListUpdateItemsProps) => void;
  };

type State = {
  activeId?: string;
};

export function DraggableRuleList({
  items,
  onUpdateItems,
  renderItem,
  disabled = false,
  wrapperStyle = () => ({}),
}: Props) {
  const [state, setState] = useState<State>({});

  const itemIds = items.map(item => item.id);
  const getIndex = itemIds.indexOf.bind(itemIds);
  const activeIndex = state.activeId ? getIndex(state.activeId) : -1;

  return (
    <DndContext
      onDragStart={({active}) => {
        if (!active) {
          return;
        }

        setState({activeId: active.id});
      }}
      onDragEnd={({over}) => {
        setState({activeId: undefined});

        if (over) {
          const overIndex = getIndex(over.id);

          if (activeIndex !== overIndex) {
            onUpdateItems({
              activeIndex,
              overIndex,
              reorderedItems: arrayMove(itemIds, activeIndex, overIndex),
            });
          }
        }
      }}
      onDragCancel={() => setState({activeId: undefined})}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {itemIds.map((itemId, index) => (
          <DraggableRuleListSortableItem
            key={itemId}
            id={itemId}
            index={index}
            renderItem={renderItem}
            disabled={
              disabled || isUniformRule({...items[index], id: Number(items[index].id)})
            }
            wrapperStyle={wrapperStyle}
          />
        ))}
      </SortableContext>
      {createPortal(
        <DragOverlay>
          {state.activeId ? (
            <DraggableRuleListItem
              value={itemIds[activeIndex]}
              renderItem={renderItem}
              wrapperStyle={wrapperStyle({
                index: activeIndex,
                isDragging: true,
                isSorting: false,
              })}
            />
          ) : null}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
