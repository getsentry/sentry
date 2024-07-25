import type React from 'react';
import {forwardRef} from 'react';
import styled from '@emotion/styled';
import type {AriaTabProps} from '@react-aria/tabs';
import {useTab} from '@react-aria/tabs';
import {useObjectRef} from '@react-aria/utils';
import type {TabListState} from '@react-stately/tabs';
import type {Node, Orientation} from '@react-types/shared';

import {BaseTab} from 'sentry/components/tabs/tab';

interface DraggableTabProps extends AriaTabProps {
  // dropState: DroppableCollectionState;
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

/**
 * Renders a single tab item. This should not be imported directly into any
 * page/view – it's only meant to be used by <TabsList />. See the correct
 * usage in tabs.stories.js
 */
export const DraggableTab = forwardRef(
  (
    {item, state, orientation, overflowing}: DraggableTabProps,
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
        variant={'filled'}
      >
        <TabContentWrap>{rendered}</TabContentWrap>
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
