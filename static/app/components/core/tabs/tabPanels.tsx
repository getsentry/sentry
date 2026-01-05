import {useContext, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {AriaTabPanelProps} from '@react-aria/tabs';
import {useTabPanel} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import type {TabListState} from '@react-stately/tabs';
import type {CollectionBase, Node, Orientation} from '@react-types/shared';

import {TabPanelItem} from './item';
import {TabsContext} from './tabs';
import {tabsShouldForwardProp} from './utils';

const collectionFactory = (nodes: Iterable<Node<any>>) => new ListCollection(nodes);

interface TabPanelsProps extends AriaTabPanelProps {
  children: CollectionBase<unknown>['children'];
  className?: string;
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function TabPanels(props: TabPanelsProps) {
  const {
    rootProps: {orientation, items},
    tabListState,
  } = useContext(TabsContext);

  // Parse child tab panels from props and identify the selected panel
  const collection = useCollection({items, ...props}, collectionFactory, {
    suppressTextValueWarning: true,
  });

  if (!tabListState) {
    return null;
  }

  const selectedPanel = tabListState.selectedKey
    ? collection.getItem(tabListState.selectedKey)
    : null;

  return (
    <TabPanel
      {...props}
      state={tabListState}
      orientation={orientation}
      key={tabListState?.selectedKey}
    >
      {selectedPanel?.props.children}
    </TabPanel>
  );
}

TabPanels.Item = TabPanelItem;

interface TabPanelProps extends AriaTabPanelProps {
  state: TabListState<any>;
  children?: React.ReactNode;
  className?: string;
  orientation?: Orientation;
}

function TabPanel({
  state,
  orientation = 'horizontal',
  className,
  children,
  ...props
}: TabPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {tabPanelProps} = useTabPanel(props, state, ref);

  return (
    <TabPanelWrap
      {...tabPanelProps}
      orientation={orientation}
      className={className}
      ref={ref}
    >
      {children}
    </TabPanelWrap>
  );
}

const TabPanelWrap = styled('div', {shouldForwardProp: tabsShouldForwardProp})<{
  orientation: Orientation;
}>`
  border-radius: ${p => p.theme.radius.md};

  ${p =>
    p.orientation === 'horizontal'
      ? css`
          height: 100%;
          padding-top: ${p.theme.space.md};
        `
      : css`
          width: 100%;
          padding-left: ${p.theme.space.md};
        `};

  &:focus-visible {
    outline: none;
    box-shadow:
      inset ${p => p.theme.focusBorder} 0 0 0 1px,
      ${p => p.theme.focusBorder} 0 0 0 1px;
    z-index: 1;
  }
`;
