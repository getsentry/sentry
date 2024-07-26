import type React from 'react';
import {forwardRef} from 'react';
import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import Badge from 'sentry/components/badge/badge';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import QueryCount from 'sentry/components/queryCount';
import {BaseTab} from 'sentry/components/tabs/tab';
import {space} from 'sentry/styles/space';
import {DraggableTabMenuButton} from 'sentry/views/issueList/draggableTabMenuButton';

interface DraggableTabProps extends AriaTabProps {
  count: number;
  item: Node<any>;
  orientation: Orientation;
  /**
   * Whether this tab is overflowing the TabList container. If so, the tab
   * needs to be visually hidden. Users can instead select it via an overflow
   * menu.
   */
  overflowing: boolean;
  state: TabListState<any>;
  hasUnsavedChanges?: boolean;
  onDelete?: (key: MenuItemProps['key']) => void;
  onDiscard?: (key: MenuItemProps['key']) => void;
  onDuplicate?: (key: MenuItemProps['key']) => void;
  onRename?: (key: MenuItemProps['key']) => void;
  onSave?: (key: MenuItemProps['key']) => void;
}

export const DraggableTab = forwardRef(
  (
    {
      count,
      item,
      state,
      orientation,
      overflowing,
      hasUnsavedChanges = false,
      ...onActionProps
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

    return (
      <StyledBaseTab
        tabProps={tabProps}
        isSelected={isSelected}
        to={to}
        hidden={hidden}
        orientation={orientation}
        overflowing={overflowing}
        ref={ref}
        variant="filled"
      >
        <TabContentWrap>
          {rendered}
          <StyledBadge>
            <QueryCount hideParens count={count} max={1000} />
          </StyledBadge>
          {state.selectedKey === item.key && (
            <DraggableTabMenuButton
              hasUnsavedChanges={hasUnsavedChanges}
              {...onActionProps}
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
