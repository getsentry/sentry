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

import Badge from 'sentry/components/badge/badge';
import {DraggableTabMenuButton} from 'sentry/components/draggableTabs/draggableTabMenuButton';
import QueryCount from 'sentry/components/queryCount';
import {BaseTab} from 'sentry/components/tabs/tab';
import {space} from 'sentry/styles/space';

interface DraggableTabProps extends AriaTabProps {
  dropState: DroppableCollectionState;
  isChanged: boolean;
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
          tab: JSON.stringify({key: item.key}),
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
    {item, state, orientation, overflowing, dropState, isChanged}: DraggableTabProps,
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
        <StyledBaseTab
          additionalProps={dropProps}
          tabProps={tabProps}
          isSelected={isSelected}
          to={to}
          hidden={hidden}
          orientation={orientation}
          overflowing={overflowing}
          ref={ref}
          newVariant
        >
          <Draggable onTabClick={() => state.setSelectedKey(item.key)} item={item}>
            <TabContentWrap>
              {rendered}
              <StyledBadge>
                <QueryCount hideParens count={1001} max={1000} />
              </StyledBadge>
              {state.selectedKey === item.key && (
                <DraggableTabMenuButton isChanged={isChanged} />
              )}
            </TabContentWrap>
          </Draggable>
        </StyledBaseTab>
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

const StyledBaseTab = styled(BaseTab)`
  padding: 2px 12px 2px 12px;
  gap: 8px;
  border-radius: 6px 6px 0px 0px;
  border: 1px solid ${p => p.theme.gray200};
  opacity: 0px;
`;

const TabContentWrap = styled('span')`
  display: flex;
  align-items: center;
  flex-direction: row;
  gap: 6px;
`;

const StyledBadge = styled(Badge)`
  display: flex;
  height: 16px;
  align-items: center;
  border-radius: 10px;
  background: transparent;
  border: 1px solid ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  margin-left: ${space(0)};
`;

const TabSeparator = styled('li')`
  height: 80%;
  width: 2px;
  background-color: ${p => p.theme.gray200};
`;
