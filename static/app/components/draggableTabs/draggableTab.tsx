import type React from 'react';
import {forwardRef, Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {
  type DropIndicatorProps,
  useDrag,
  useDropIndicator,
  useDroppableItem,
} from '@react-aria/dnd';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {mergeProps, useObjectRef} from '@react-aria/utils';
import type {DroppableCollectionState} from '@react-stately/dnd';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import {BaseTab} from 'sentry/components/tabs/tab';

interface DraggableTabProps extends AriaTabProps {
  dropState: DroppableCollectionState;
  item: Node<any>;
  orientation: Orientation;
  /**
   * Whether this tab is overflowing the TabList container. If so, the tab
   * needs to be visually hidden. Users can instead select it via an overflow
   * menu.
   */
  overflowing: boolean;
  state: TabListState<any>;
}

interface BaseDropIndicatorProps {
  dropState: DroppableCollectionState;
  target: DropIndicatorProps['target'];
}

function TabDropIndicator(props: BaseDropIndicatorProps) {
  const ref = useRef(null);
  const {dropIndicatorProps, isHidden} = useDropIndicator(props, props.dropState, ref);
  if (isHidden) {
    return null;
  }

  return <TabSeparator {...dropIndicatorProps} role="option" ref={ref} />;
}

interface DraggableProps {
  children: React.ReactNode;
  item: Node<any>;
  onTabClick: () => void;
}

function Draggable({item, children, onTabClick}: DraggableProps) {
  // TODO(msun): Implement the "preview" parameter in this useDrag hook
  const {dragProps, dragButtonProps} = useDrag({
    getAllowedDropOperations: () => ['move'],
    getItems() {
      return [
        {
          tab: JSON.stringify({key: item.key, value: children}),
        },
      ];
    },
  });

  const ref = useRef(null);
  const {buttonProps} = useButton({...dragButtonProps, elementType: 'div'}, ref);

  return (
    <div {...mergeProps(buttonProps, dragProps)} ref={ref} onClick={onTabClick}>
      {children}
    </div>
  );
}

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
export const DraggableTab = forwardRef(
  (
    {item, state, orientation, overflowing, dropState}: DraggableTabProps,
    forwardedRef: React.ForwardedRef<HTMLLIElement>
  ) => {
    const ref = useObjectRef(forwardedRef);

    const {
      key,
      rendered,
      props: {to, hidden},
    } = item;
    const {tabProps, isSelected} = useTab({key, isDisabled: hidden}, state, ref);

    const {dropProps} = useDroppableItem(
      {
        target: {type: 'item', key: item.key, dropPosition: 'on'},
      },
      dropState,
      ref
    );

    return (
      <Fragment>
        <TabDropIndicator
          target={{type: 'item', key: item.key, dropPosition: 'before'}}
          dropState={dropState}
        />
        <BaseTab
          additionalProps={dropProps}
          tabProps={tabProps}
          isSelected={isSelected}
          to={to}
          hidden={hidden}
          orientation={orientation}
          overflowing={overflowing}
          ref={ref}
        >
          <Draggable onTabClick={() => state.setSelectedKey(item.key)} item={item}>
            {rendered}
          </Draggable>
        </BaseTab>
        {state.collection.getKeyAfter(item.key) == null && (
          <TabDropIndicator
            target={{type: 'item', key: item.key, dropPosition: 'after'}}
            dropState={dropState}
          />
        )}
      </Fragment>
    );
  }
);

const TabSeparator = styled('li')`
  height: 80%;
  width: 2px;
  background-color: ${p => p.theme.gray200};
`;
