import type React from 'react';
import {forwardRef} from 'react';
import styled from '@emotion/styled';
import {useDroppableItem} from '@react-aria/dnd';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
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
  isTempTab?: boolean;
  onDelete?: () => void;
  onDiscard?: () => void;
  onDuplicate?: () => void;
  onRename?: () => void;
  onSave?: () => void;
}

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
export const DraggableTab = forwardRef(
  (
    {
      item,
      state,
      orientation,
      overflowing,
      dropState,
      isChanged,
      isTempTab = false,
      onDelete,
      onDiscard,
      onDuplicate,
      onRename,
      onSave,
    }: DraggableTabProps,
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
      <StyledBaseTab
        additionalProps={dropProps}
        tabProps={tabProps}
        isSelected={isSelected}
        isTempTab={isTempTab}
        to={to}
        hidden={hidden}
        orientation={orientation}
        overflowing={overflowing}
        ref={ref}
        newVariant
      >
        <TabContentWrap>
          {rendered}
          <StyledBadge>
            <QueryCount hideParens count={1} max={1000} />
          </StyledBadge>
          {state.selectedKey === item.key && (
            <DraggableTabMenuButton
              onDelete={onDelete}
              onDiscard={onDiscard}
              onDuplicate={onDuplicate}
              onRename={onRename}
              onSave={onSave}
              isChanged={isChanged}
            />
          )}
        </TabContentWrap>
      </StyledBaseTab>
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
  justify-content: center;
  border-radius: 10px;
  background: transparent;
  border: 1px solid ${p => p.theme.gray200};
  color: ${p => p.theme.gray300};
  margin-left: ${space(0)};
`;
