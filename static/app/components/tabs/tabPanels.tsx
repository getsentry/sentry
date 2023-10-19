import {useContext, useRef} from 'react';
import styled from '@emotion/styled';
import {AriaTabPanelProps, useTabPanel} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import {TabListState} from '@react-stately/tabs';
import {CollectionBase, Node, Orientation} from '@react-types/shared';

import {TabsContext} from './index';
import {Item} from './item';
import {tabsShouldForwardProp} from './utils';

const collectionFactory = (nodes: Iterable<Node<any>>) => new ListCollection(nodes);

interface TabPanelsProps extends AriaTabPanelProps, CollectionBase<any> {
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
  const selectedPanel = tabListState
    ? collection.getItem(tabListState.selectedKey)
    : null;

  if (!tabListState) {
    return null;
  }

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

TabPanels.Item = Item;

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
  border-radius: ${p => p.theme.borderRadius};

  ${p => (p.orientation === 'horizontal' ? `height: 100%;` : `width: 100%;`)};

  &.focus-visible {
    outline: none;
    box-shadow:
      inset ${p => p.theme.focusBorder} 0 0 0 1px,
      ${p => p.theme.focusBorder} 0 0 0 1px;
    z-index: 1;
  }
`;
