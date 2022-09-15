import {useContext, useRef} from 'react';
import styled from '@emotion/styled';
import {AriaTabPanelProps, useTabPanel} from '@react-aria/tabs';
import {useCollection} from '@react-stately/collections';
import {ListCollection} from '@react-stately/list';
import {TabListState} from '@react-stately/tabs';
import {Node, Orientation, CollectionBase} from '@react-types/shared';

import space from 'sentry/styles/space';

import {TabsContext} from './index';

interface TabPanelsProps<T> extends AriaTabPanelProps, CollectionBase<T> {
  className?: string;
}

/**
 * To be used as a direct child of the <Tabs /> component. See example usage
 * in tabs.stories.js
 */
export function TabPanels<T>(props: TabPanelsProps<T>) {
  const {
    rootProps: {orientation, items},
    tabListState,
  } = useContext(TabsContext);

  // Parse child tab panels from props and identify the selected panel
  const factory = nodes => new ListCollection<Node<object>>(nodes);
  const collection = useCollection({items, ...props}, factory);
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
      {selectedPanel && selectedPanel.props.children}
    </TabPanel>
  );
}

interface TabPanelProps<T> extends AriaTabPanelProps {
  orientation: Orientation;
  state: TabListState<T>;
  children?: React.ReactNode;
  className?: string;
}

function TabPanel<T>({state, orientation, className, ...props}: TabPanelProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const {tabPanelProps} = useTabPanel(props, state, ref);

  return (
    <TabPanelWrap
      {...tabPanelProps}
      orientation={orientation}
      className={className}
      ref={ref}
    >
      {props.children}
    </TabPanelWrap>
  );
}

const TabPanelWrap = styled('div')<{orientation: Orientation}>`
  border-radius: ${p => p.theme.borderRadius};

  ${p =>
    p.orientation === 'horizontal'
      ? `
          height: 100%;
          padding: ${space(2)} 0;
        `
      : `
          width: 100%;
          padding: 0 ${space(2)};
        `};

  &.focus-visible {
    outline: none;
    box-shadow: inset ${p => p.theme.focusBorder} 0 0 0 1px,
      ${p => p.theme.focusBorder} 0 0 0 1px;
    z-index: 1;
  }
`;
